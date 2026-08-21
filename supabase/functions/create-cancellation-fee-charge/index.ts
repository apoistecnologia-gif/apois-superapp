import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_CLIENT_ID = Deno.env.get("MERCADOPAGO_CLIENT_ID") ?? "";
const MP_CLIENT_SECRET = Deno.env.get("MERCADOPAGO_CLIENT_SECRET") ?? "";
const MP_TEST_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_TEST_ACCESS_TOKEN") ?? "";
const TOKEN_KEY_B64 = Deno.env.get("MERCADOPAGO_TOKEN_ENCRYPTION_KEY") ?? "";
const HOMOLOGATION_ONLY = (Deno.env.get("MERCADOPAGO_HOMOLOGATION_ONLY") ?? "true").trim().toLowerCase() !== "false";
const MP_BASE = (Deno.env.get("MERCADOPAGO_BASE_URL")?.trim() || "https://api.mercadopago.com").replace(/\/+$/, "");
const FEE_WEBHOOK_URL = Deno.env.get("MERCADOPAGO_CANCELLATION_FEE_WEBHOOK_URL") || `${SUPABASE_URL}/functions/v1/cancellation-fee-webhook`;

type TokenBundle = { accessToken: string; refreshToken: string; expiresAt: string | null };

function cors(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  const origin = req.headers.get("Origin");
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "").split(",").map((v) => v.trim()).filter(Boolean);
  if (origin && (allowed.includes(origin) || ["https://localhost", "capacitor://localhost", "ionic://localhost"].includes(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "content-type": "application/json" } });
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
  if (packed.length < 29) throw new Error("invalid_ciphertext");
  const key = await cryptoKey(["decrypt"]);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, key, packed.slice(12));
  return new TextDecoder().decode(plaintext);
}
async function encrypt(value: string) {
  const key = await cryptoKey(["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  const packed = new Uint8Array(iv.length + ciphertext.length);
  packed.set(iv, 0); packed.set(ciphertext, iv.length);
  return toB64(packed);
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
    if (!response.ok || typeof body.access_token !== "string") {
      await admin.from("driver_mercadopago_accounts").update({ status: "expired", last_error: `refresh_failed_${response.status}`, updated_at: new Date().toISOString() }).eq("driver_id", driverId);
      throw new Error("driver_mercadopago_refresh_failed");
    }
    accessToken = body.access_token;
    if (typeof body.refresh_token === "string" && body.refresh_token) refreshToken = body.refresh_token;
    const expiresIn = Number(body.expires_in ?? 0);
    expiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
    await admin.from("driver_mercadopago_credentials").update({ access_token_ciphertext: await encrypt(accessToken), refresh_token_ciphertext: await encrypt(refreshToken), updated_at: new Date().toISOString() }).eq("driver_id", driverId);
    await admin.from("driver_mercadopago_accounts").update({ status: "connected", token_expires_at: expiresAt, refreshed_at: new Date().toISOString(), last_error: null, updated_at: new Date().toISOString() }).eq("driver_id", driverId);
  }
  return { accessToken, refreshToken, expiresAt };
}
function cleanEmail(value: unknown): string | null {
  const email = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 180) : null;
}
function providerError(body: Record<string, unknown>, status: number) {
  return [body.message, body.error, body.code, body.status, body.status_detail, `http_${status}`].filter(Boolean).join(" | ").slice(0, 1500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_CLIENT_ID || !MP_CLIENT_SECRET || !TOKEN_KEY_B64) {
    return json(req, { error: "mercadopago_configuration_missing", message: "O pagamento Pix ainda não está configurado." }, 503);
  }

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json(req, { error: "unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(token);
    if (authError || !auth.user) return json(req, { error: "unauthorized" }, 401);
    const { data: profile } = await admin.from("users").select("id,email,name,cpf,deleted_at").eq("auth_user_id", auth.user.id).maybeSingle();
    if (!profile || profile.deleted_at) return json(req, { error: "passenger_profile_missing" }, 404);

    const input = await req.json().catch(() => ({})) as { feeId?: string };
    let feeQuery = admin.from("cancellation_fees").select("id,ride_id,passenger_id,amount,status,is_paid,provider,provider_payment_id,beneficiary_driver_id,provider_seller_id,application_fee_cents,mp_order_id,mp_order_status,mp_payment_id,mp_payment_status,mp_qr_code,mp_qr_code_base64,mp_ticket_url,mp_expires_at,updated_at").eq("passenger_id", profile.id).eq("is_paid", false).in("status", ["pending", "open", "unpaid", "processing"]).order("created_at", { ascending: true }).limit(1);
    if (input.feeId?.trim()) feeQuery = feeQuery.eq("id", input.feeId.trim());
    const { data: fee, error: feeError } = await feeQuery.maybeSingle();
    if (feeError) return json(req, { error: "fee_lookup_failed" }, 500);
    if (!fee) return json(req, { error: "fee_not_found_or_paid", message: "Esta multa não está mais pendente." }, 404);
    const amount = Number(fee.amount ?? 0);
    if (!(amount > 0) || !fee.ride_id) return json(req, { error: "fee_beneficiary_unavailable", message: "Não foi possível identificar o motorista beneficiário desta multa." }, 409);

    const { data: ride, error: rideError } = await admin.from("rides").select("id,driver_id,accepted_driver_id").eq("id", fee.ride_id).maybeSingle();
    if (rideError || !ride) return json(req, { error: "ride_not_found" }, 404);
    const driverId = String(fee.beneficiary_driver_id || ride.accepted_driver_id || ride.driver_id || "").trim();
    if (!driverId) return json(req, { error: "driver_beneficiary_missing", message: "Esta multa não possui motorista beneficiário válido." }, 409);

    const { data: seller, error: sellerError } = await admin.from("driver_mercadopago_accounts").select("mercadopago_user_id,status,live_mode").eq("driver_id", driverId).maybeSingle();
    if (sellerError || !seller || seller.status !== "connected" || !seller.mercadopago_user_id) {
      return json(req, { error: "driver_mercadopago_not_connected", message: "O motorista ainda não possui uma conta Mercado Pago conectada para receber esta multa diretamente." }, 409);
    }
    if (HOMOLOGATION_ONLY && seller.live_mode === true) return json(req, { error: "mercadopago_live_account_blocked_in_homologation" }, 409);
    const isTestSeller = seller.live_mode !== true;
    if (isTestSeller && !MP_TEST_ACCESS_TOKEN) return json(req, { error: "mercadopago_test_access_token_missing" }, 503);

    await admin.from("cancellation_fees").update({ beneficiary_driver_id: driverId, provider_seller_id: seller.mercadopago_user_id, application_fee_cents: 0, updated_at: new Date().toISOString() }).eq("id", fee.id);

    const reusableStatus = ["", "created", "processing", "action_required", "pending", "in_process", "authorized"].includes(String(fee.mp_order_status || fee.mp_payment_status || "").toLowerCase());
    const sameBeneficiary = !fee.provider_seller_id || fee.provider_seller_id === seller.mercadopago_user_id;
    const reusable = sameBeneficiary && Number(fee.application_fee_cents ?? 0) === 0 && Boolean((fee.mp_order_id || fee.mp_payment_id) && fee.mp_qr_code) && (!fee.mp_expires_at || new Date(fee.mp_expires_at).getTime() > Date.now() + 60_000) && reusableStatus;
    if (reusable) {
      return json(req, { ok: true, reused: true, feeId: fee.id, amount, orderId: fee.mp_order_id ?? null, paymentId: fee.mp_payment_id ?? null, qrCode: fee.mp_qr_code, qrCodeBase64: fee.mp_qr_code_base64, ticketUrl: fee.mp_ticket_url, expiresAt: fee.mp_expires_at, beneficiaryDriverId: driverId, sellerId: seller.mercadopago_user_id, applicationFeeCents: 0, directToDriver: !isTestSeller });
    }

    const payerEmail = cleanEmail(profile.email) || cleanEmail(auth.user.email) || `passageiro-${auth.user.id.slice(0, 8)}@apois.app`;
    const webhook = `${FEE_WEBHOOK_URL}${FEE_WEBHOOK_URL.includes("?") ? "&" : "?"}fee_id=${encodeURIComponent(fee.id)}`;
    let orderId: string | null = null;
    let paymentId: string | null = null;
    let providerStatus = "pending";
    let providerStatusDetail: string | null = null;
    let qrCode: string | null = null;
    let qrCodeBase64: string | null = null;
    let ticketUrl: string | null = null;
    let expiresAt: string | null = null;

    if (isTestSeller) {
      const value = amount.toFixed(2);
      const response = await fetch(`${MP_BASE}/v1/orders`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", Authorization: `Bearer ${MP_TEST_ACCESS_TOKEN}`, "X-Idempotency-Key": `fee-${fee.id}-${Math.floor(Date.now() / 3600000)}` },
        body: JSON.stringify({ type: "online", processing_mode: "automatic", external_reference: `fee:${fee.id}`, total_amount: value, payer: { email: "test_user_br@testuser.com", first_name: "APRO" }, transactions: { payments: [{ amount: value, payment_method: { id: "pix", type: "bank_transfer" } }] } }),
      });
      const body = await response.json().catch(() => ({})) as Record<string, any>;
      if (!response.ok || !body.id) return json(req, { error: "mercadopago_pix_failed", message: "Não foi possível gerar o Pix agora.", detail: providerError(body, response.status) }, 502);
      const payment = body.transactions?.payments?.[0] ?? {};
      const method = payment.payment_method ?? {};
      orderId = String(body.id);
      paymentId = payment.id ? String(payment.id) : null;
      providerStatus = String(payment.status ?? body.status ?? "pending");
      providerStatusDetail = String(payment.status_detail ?? body.status_detail ?? "waiting_payment");
      qrCode = typeof method.qr_code === "string" ? method.qr_code : null;
      qrCodeBase64 = typeof method.qr_code_base64 === "string" ? method.qr_code_base64 : null;
      ticketUrl = typeof method.ticket_url === "string" ? method.ticket_url : null;
      expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    } else {
      const accessToken = (await loadSellerToken(admin, driverId)).accessToken;
      const payer: Record<string, unknown> = { email: payerEmail };
      const cpf = String(profile.cpf ?? "").replace(/\D/g, "");
      if (cpf.length === 11) payer.identification = { type: "CPF", number: cpf };
      const response = await fetch(`${MP_BASE}/v1/payments`, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json", Authorization: `Bearer ${accessToken}`, "X-Idempotency-Key": `fee-${fee.id}-${Math.floor(Date.now() / 3600000)}` },
        body: JSON.stringify({ transaction_amount: amount, description: `APOIS Multa de cancelamento ${String(fee.ride_id).slice(0, 8)}`, payment_method_id: "pix", payer, external_reference: `fee:${fee.id}`, notification_url: webhook, metadata: { kind: "cancellation_fee", fee_id: fee.id, ride_id: fee.ride_id, driver_id: driverId, apois_marketplace_fee_cents: 0 } }),
      });
      const body = await response.json().catch(() => ({})) as Record<string, any>;
      if (!response.ok || body.id == null) return json(req, { error: "mercadopago_pix_failed", message: "Não foi possível gerar o Pix agora.", detail: providerError(body, response.status) }, 502);
      const tx = body.point_of_interaction?.transaction_data ?? {};
      paymentId = String(body.id);
      providerStatus = String(body.status ?? "pending");
      providerStatusDetail = body.status_detail ? String(body.status_detail) : null;
      qrCode = typeof tx.qr_code === "string" ? tx.qr_code : null;
      qrCodeBase64 = typeof tx.qr_code_base64 === "string" ? tx.qr_code_base64 : null;
      ticketUrl = typeof tx.ticket_url === "string" ? tx.ticket_url : null;
      expiresAt = body.date_of_expiration ? String(body.date_of_expiration) : null;
    }

    if (!qrCode) return json(req, { error: "pix_qr_missing", message: "O Mercado Pago não retornou um QR Code válido." }, 502);
    const paidNow = providerStatus === "approved" || providerStatus === "processed";
    const patch = {
      fee_amount: amount, value: amount, status: paidNow ? "paid" : "processing", provider: "mercadopago",
      provider_payment_id: paymentId || orderId, beneficiary_driver_id: driverId, provider_seller_id: seller.mercadopago_user_id, application_fee_cents: 0,
      mp_order_id: orderId, mp_order_status: orderId ? providerStatus : null, mp_order_status_detail: orderId ? providerStatusDetail : null,
      mp_payment_id: paymentId, mp_payment_status: paymentId ? providerStatus : null,
      qr_code: qrCode, qr_code_base64: qrCodeBase64, ticket_url: ticketUrl, expires_at: expiresAt,
      mp_qr_code: qrCode, mp_qr_code_base64: qrCodeBase64, mp_ticket_url: ticketUrl, mp_expires_at: expiresAt, updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await admin.from("cancellation_fees").update(patch).eq("id", fee.id).eq("passenger_id", profile.id);
    if (updateError) return json(req, { error: "pix_persistence_failed" }, 500);
    if (paidNow) {
      const { error: settleError } = await admin.rpc("settle_cancellation_fee", { _fee_id: fee.id });
      if (settleError) return json(req, { error: "fee_settlement_failed" }, 500);
    }
    return json(req, { ok: true, reused: false, feeId: fee.id, amount, orderId, paymentId, qrCode, qrCodeBase64, ticketUrl, expiresAt, beneficiaryDriverId: driverId, sellerId: seller.mercadopago_user_id, applicationFeeCents: 0, directToDriver: !isTestSeller });
  } catch (error) {
    console.error("create_fee_charge_fatal", error);
    const message = error instanceof Error && error.message === "driver_mercadopago_not_connected"
      ? "O motorista ainda não possui uma conta Mercado Pago conectada para receber esta multa diretamente."
      : "Não foi possível gerar o Pix agora.";
    return json(req, { error: "unexpected_error", message }, 500);
  }
});
