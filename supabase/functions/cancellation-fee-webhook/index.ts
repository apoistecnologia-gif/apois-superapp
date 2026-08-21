import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_CLIENT_ID = Deno.env.get("MERCADOPAGO_CLIENT_ID") ?? "";
const MP_CLIENT_SECRET = Deno.env.get("MERCADOPAGO_CLIENT_SECRET") ?? "";
const MP_TEST_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN") ?? "";
const TOKEN_KEY_B64 = Deno.env.get("MERCADOPAGO_TOKEN_ENCRYPTION_KEY") ?? "";
const MP_SECRET = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET")?.trim() ?? "";
const MP_BASE = (Deno.env.get("MERCADOPAGO_BASE_URL")?.trim() || "https://api.mercadopago.com").replace(/\/+$/, "");

type TokenBundle = { accessToken: string; refreshToken: string; expiresAt: string | null };
type Resource = {
  feeId: string;
  amount: number;
  orderId: string | null;
  orderStatus: string | null;
  orderStatusDetail: string | null;
  paymentId: string | null;
  paymentStatus: string | null;
  paid: boolean;
  reversed: boolean;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function signatureParts(signature: string): Record<string, string> {
  return Object.fromEntries(signature.split(",").map((part) => { const [key, ...rest] = part.trim().split("="); return [key, rest.join("=")]; }));
}
async function validSignature(dataId: string, requestId: string, signature: string): Promise<boolean> {
  if (!MP_SECRET || !dataId || !requestId || !signature) return false;
  const parts = signatureParts(signature);
  const timestampRaw = Number(parts.ts);
  const received = String(parts.v1 ?? "").toLowerCase();
  if (!Number.isFinite(timestampRaw) || !received) return false;
  const timestampMs = timestampRaw > 1_000_000_000_000 ? timestampRaw : timestampRaw * 1000;
  if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(MP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(signed)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return safeEqual(expected, received);
}
function fromB64(value: string) { const binary = atob(value); return Uint8Array.from(binary, (ch) => ch.charCodeAt(0)); }
function toB64(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
async function cryptoKey(usages: KeyUsage[]) {
  const raw = fromB64(TOKEN_KEY_B64);
  if (raw.length !== 32) throw new Error("invalid_encryption_key");
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, usages);
}
async function decrypt(packedB64: string) {
  const packed = fromB64(packedB64);
  const key = await cryptoKey(["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, key, packed.slice(12));
  return new TextDecoder().decode(plaintext);
}
async function encrypt(value: string) {
  const key = await cryptoKey(["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  const packed = new Uint8Array(iv.length + ciphertext.length); packed.set(iv, 0); packed.set(ciphertext, iv.length); return toB64(packed);
}
async function loadSellerToken(admin: ReturnType<typeof createClient>, driverId: string): Promise<TokenBundle> {
  const { data: account, error: accountError } = await admin.from("driver_mercadopago_accounts").select("status,token_expires_at").eq("driver_id", driverId).maybeSingle();
  if (accountError || !account || account.status !== "connected") throw new Error("driver_mercadopago_not_connected");
  const { data: creds, error: credsError } = await admin.from("driver_mercadopago_credentials").select("access_token_ciphertext,refresh_token_ciphertext").eq("driver_id", driverId).maybeSingle();
  if (credsError || !creds?.access_token_ciphertext || !creds.refresh_token_ciphertext) throw new Error("driver_mercadopago_credentials_missing");
  let accessToken = await decrypt(creds.access_token_ciphertext);
  let refreshToken = await decrypt(creds.refresh_token_ciphertext);
  let expiresAt = account.token_expires_at as string | null;
  const refreshNeeded = !expiresAt || new Date(expiresAt).getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000;
  if (refreshNeeded) {
    const form = new URLSearchParams({ client_id: MP_CLIENT_ID, client_secret: MP_CLIENT_SECRET, grant_type: "refresh_token", refresh_token: refreshToken });
    const response = await fetch(`${MP_BASE}/oauth/token`, { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: form });
    const body = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok || typeof body.access_token !== "string") throw new Error("driver_mercadopago_refresh_failed");
    accessToken = body.access_token;
    if (typeof body.refresh_token === "string" && body.refresh_token) refreshToken = body.refresh_token;
    const expiresIn = Number(body.expires_in ?? 0);
    expiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    await admin.from("driver_mercadopago_credentials").update({ access_token_ciphertext: await encrypt(accessToken), refresh_token_ciphertext: await encrypt(refreshToken), updated_at: new Date().toISOString() }).eq("driver_id", driverId);
    await admin.from("driver_mercadopago_accounts").update({ status: "connected", token_expires_at: expiresAt, refreshed_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("driver_id", driverId);
  }
  return { accessToken, refreshToken, expiresAt };
}
function feeIdFromReference(value: unknown): string {
  const reference = String(value ?? "");
  return reference.startsWith("fee:") ? reference.slice(4) : "";
}
async function fetchPayment(accessToken: string, paymentId: string): Promise<Resource> {
  const response = await fetch(`${MP_BASE}/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { accept: "application/json", Authorization: `Bearer ${accessToken}` } });
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) throw new Error(`MP_PAYMENT_HTTP_${response.status}`);
  const feeId = String(body.metadata?.fee_id ?? feeIdFromReference(body.external_reference));
  const refFeeId = feeIdFromReference(body.external_reference);
  if (!feeId || (refFeeId && feeId !== refFeeId)) throw new Error("fee_reference_mismatch");
  const status = String(body.status ?? "").toLowerCase();
  return { feeId, amount: Number(body.transaction_amount ?? 0), orderId: null, orderStatus: null, orderStatusDetail: null, paymentId: String(body.id ?? paymentId), paymentStatus: status, paid: status === "approved", reversed: ["refunded", "charged_back"].includes(status) };
}
async function fetchOrder(accessToken: string, orderId: string): Promise<Resource> {
  const response = await fetch(`${MP_BASE}/v1/orders/${encodeURIComponent(orderId)}`, { headers: { accept: "application/json", Authorization: `Bearer ${accessToken}` } });
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) throw new Error(`MP_ORDER_HTTP_${response.status}`);
  const payment = body.transactions?.payments?.[0] ?? {};
  const feeId = feeIdFromReference(body.external_reference);
  if (!feeId) throw new Error("fee_reference_missing");
  const orderStatus = String(body.status ?? "").toLowerCase();
  const orderDetail = String(body.status_detail ?? "").toLowerCase();
  const paymentStatus = String(payment.status ?? "").toLowerCase();
  const paymentDetail = String(payment.status_detail ?? "").toLowerCase();
  const paid = paymentStatus === "approved" || (orderStatus === "processed" && ["", "accredited"].includes(orderDetail)) || (paymentStatus === "processed" && ["", "accredited"].includes(paymentDetail));
  const combined = `${orderStatus} ${orderDetail} ${paymentStatus} ${paymentDetail}`;
  const reversed = ["refunded", "partially_refunded", "charged_back", "chargeback"].some((marker) => combined.includes(marker));
  return { feeId, amount: Number(body.total_amount ?? payment.amount ?? 0), orderId: String(body.id ?? orderId), orderStatus, orderStatusDetail: orderDetail, paymentId: payment.id ? String(payment.id) : null, paymentStatus: paymentStatus || null, paid, reversed };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_SECRET || !MP_CLIENT_ID || !MP_CLIENT_SECRET || !TOKEN_KEY_B64) return json({ error: "mercadopago_configuration_missing" }, 503);
  const raw = await req.text();
  let payload: { type?: string; action?: string; data?: { id?: string | number }; id?: string | number } = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { return json({ error: "invalid_json" }, 400); }
  const url = new URL(req.url);
  const eventType = String(payload.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "").toLowerCase();
  const dataId = String(payload.data?.id ?? payload.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!eventType || !dataId) return json({ ok: true, ignored: "missing_event_identity" });
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(dataId)) return json({ error: "invalid_event_identity" }, 422);
  const requestId = req.headers.get("x-request-id") ?? "";
  const signature = req.headers.get("x-signature") ?? "";
  if (!(await validSignature(dataId, requestId, signature).catch(() => false))) return json({ error: "invalid_signature" }, 401);
  if (!new Set(["payment", "order"]).has(eventType)) return json({ ok: true, ignored: eventType });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const eventKey = `cancellation_fee_direct:${eventType}:${payload.action ?? ""}:${dataId}:${signatureParts(signature).ts ?? ""}`;
  const { data: receipt, error: receiptError } = await admin.from("payment_webhook_receipts").insert({ provider: "mercadopago", event_key: eventKey, request_id: requestId, status: "processing", raw_payload: payload }).select("id").single();
  if (receiptError?.code === "23505") return json({ ok: true, duplicate: true });
  if (receiptError || !receipt) return json({ error: "receipt_write_failed" }, 500);
  const finish = async (status: string, detail?: string) => {
    await admin.from("payment_webhook_receipts").update({ status, detail: detail?.slice(0, 500) ?? null, processed_at: new Date().toISOString() }).eq("id", receipt.id);
  };

  try {
    const hintedFeeId = String(url.searchParams.get("fee_id") ?? "").trim();
    let feeQuery = admin.from("cancellation_fees").select("id,ride_id,passenger_id,amount,status,is_paid,beneficiary_driver_id,provider_seller_id,application_fee_cents,mp_order_id,mp_payment_id");
    if (hintedFeeId && /^[0-9a-f-]{36}$/i.test(hintedFeeId)) feeQuery = feeQuery.eq("id", hintedFeeId);
    else feeQuery = feeQuery.or(`mp_payment_id.eq.${dataId},provider_payment_id.eq.${dataId},mp_order_id.eq.${dataId}`);
    const { data: fee, error: feeError } = await feeQuery.limit(1).maybeSingle();
    if (feeError || !fee) throw new Error("fee_not_found");
    let driverId = String(fee.beneficiary_driver_id ?? "").trim();
    if (!driverId && fee.ride_id) {
      const { data: ride } = await admin.from("rides").select("driver_id,accepted_driver_id").eq("id", fee.ride_id).maybeSingle();
      driverId = String(ride?.accepted_driver_id || ride?.driver_id || "").trim();
    }
    if (!driverId) throw new Error("driver_beneficiary_missing");
    const { data: seller, error: sellerError } = await admin.from("driver_mercadopago_accounts").select("mercadopago_user_id,status,live_mode").eq("driver_id", driverId).maybeSingle();
    if (sellerError || !seller || seller.status !== "connected" || !seller.mercadopago_user_id) throw new Error("driver_mercadopago_not_connected");
    if (fee.provider_seller_id && fee.provider_seller_id !== seller.mercadopago_user_id) throw new Error("seller_reference_mismatch");
    if (Number(fee.application_fee_cents ?? 0) !== 0) throw new Error("unexpected_application_fee");

    const accessToken = seller.live_mode === true ? (await loadSellerToken(admin, driverId)).accessToken : MP_TEST_ACCESS_TOKEN;
    if (!accessToken) throw new Error("mercadopago_access_token_missing");
    const resource = eventType === "order" ? await fetchOrder(accessToken, dataId) : await fetchPayment(accessToken, dataId);
    if (resource.feeId !== fee.id) throw new Error("fee_reference_mismatch");
    const expected = Number(fee.amount ?? 0);
    if (!(expected > 0) || Math.abs(expected - resource.amount) > 0.01) {
      await finish("rejected", "amount_mismatch");
      return json({ error: "amount_mismatch" }, 422);
    }

    const alreadyPaid = fee.is_paid === true || fee.status === "paid";
    const { error: updateError } = await admin.from("cancellation_fees").update({
      provider: "mercadopago", provider_payment_id: resource.paymentId || resource.orderId || dataId,
      beneficiary_driver_id: driverId, provider_seller_id: seller.mercadopago_user_id, application_fee_cents: 0,
      mp_order_id: resource.orderId ?? fee.mp_order_id, mp_order_status: resource.orderStatus, mp_order_status_detail: resource.orderStatusDetail,
      mp_payment_id: resource.paymentId ?? fee.mp_payment_id, mp_payment_status: resource.paymentStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", fee.id);
    if (updateError) throw new Error(`fee_update_failed:${updateError.message}`);

    if (resource.paid && !alreadyPaid) {
      const { error } = await admin.rpc("settle_cancellation_fee", { _fee_id: fee.id });
      if (error) throw new Error(`settlement_failed:${error.message}`);
    }
    if (resource.reversed && alreadyPaid) {
      const { error } = await admin.rpc("reverse_cancellation_fee_settlement", { _fee_id: fee.id });
      if (error) throw new Error(`reversal_failed:${error.message}`);
    }

    await finish("processed", `fee:${fee.id};driver:${driverId};paid:${resource.paid};reversed:${resource.reversed};direct:${seller.live_mode === true}`);
    return json({ ok: true, processed: "cancellation_fee_direct_driver", feeId: fee.id, beneficiaryDriverId: driverId, sellerId: seller.mercadopago_user_id, applicationFeeCents: 0, paid: resource.paid, reversed: resource.reversed });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("cancellation_fee_webhook_failed", detail);
    await finish("error", detail);
    return json({ error: "processing_failed" }, 500);
  }
});
