import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_CLIENT_ID = Deno.env.get("MERCADOPAGO_CLIENT_ID") ?? "";
const MP_CLIENT_SECRET = Deno.env.get("MERCADOPAGO_CLIENT_SECRET") ?? "";
const TOKEN_KEY_B64 = Deno.env.get("MERCADOPAGO_TOKEN_ENCRYPTION_KEY") ?? "";
const MP_WEBHOOK_URL = Deno.env.get("MERCADOPAGO_WEBHOOK_URL") || `${SUPABASE_URL}/functions/v1/mercadopago-webhook`;

type TokenBundle = { accessToken: string; refreshToken: string; expiresAt: string | null };
function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }); }
function fromB64(value: string) { const binary = atob(value); return Uint8Array.from(binary, (ch) => ch.charCodeAt(0)); }
function toB64(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
async function cryptoKey(usages: KeyUsage[]) { const raw = fromB64(TOKEN_KEY_B64); if (raw.length !== 32) throw new Error("invalid_encryption_key"); return crypto.subtle.importKey("raw", raw, "AES-GCM", false, usages); }
async function decrypt(packedB64: string) { const packed = fromB64(packedB64); if (packed.length < 29) throw new Error("invalid_ciphertext"); const key = await cryptoKey(["decrypt"]); const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: packed.slice(0, 12) }, key, packed.slice(12)); return new TextDecoder().decode(plaintext); }
async function encrypt(value: string) { const key = await cryptoKey(["encrypt"]); const iv = crypto.getRandomValues(new Uint8Array(12)); const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value))); const packed = new Uint8Array(iv.length + ciphertext.length); packed.set(iv, 0); packed.set(ciphertext, iv.length); return toB64(packed); }

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
    const response = await fetch("https://api.mercadopago.com/oauth/token", { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: form });
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_CLIENT_ID || !MP_CLIENT_SECRET || !TOKEN_KEY_B64 || !MP_WEBHOOK_URL) return json({ error: "mercadopago_configuration_missing" }, 503);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "unauthorized" }, 401);
  const input = await req.json().catch(() => ({})) as { rideId?: string; action?: string };
  const rideId = String(input.rideId ?? "").trim();
  if (!rideId) return json({ error: "ride_id_required" }, 422);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "unauthorized" }, 401);
  const { data: passenger } = await admin.from("users").select("id,email,name,cpf,deleted_at").eq("auth_user_id", authData.user.id).maybeSingle();
  if (!passenger || passenger.deleted_at) return json({ error: "passenger_profile_missing" }, 404);
  const { data: ride, error: rideError } = await admin.from("rides").select("id,passenger_id,driver_id,accepted_driver_id,status,payment_method,payment_status,estimated_price,fare_amount_cents").eq("id", rideId).eq("passenger_id", passenger.id).maybeSingle();
  if (rideError || !ride) return json({ error: "ride_not_found" }, 404);
  if (ride.payment_method !== "pix") return json({ error: "ride_payment_method_not_pix" }, 409);
  if (ride.payment_status === "paid") return json({ error: "ride_already_paid" }, 409);
  const driverId = ride.accepted_driver_id || ride.driver_id;
  if (!driverId) return json({ error: "driver_must_be_reserved_before_pix" }, 409);
  if (ride.status !== "aguardando_pagamento") return json({ error: "ride_not_awaiting_payment", status: ride.status }, 409);

  const existing = await admin.from("ride_pix_payments").select("id,provider_payment_id,status,pix_payload,pix_qr_code_base64,pix_expiration_at,amount_cents,provider_seller_id").eq("ride_id", rideId).eq("provider", "mercadopago").in("status", ["creating", "pending"]).order("attempt_number", { ascending: false }).limit(1).maybeSingle();
  if (existing.data?.provider_payment_id && input.action !== "retry") return json({ provider: "mercadopago", paymentId: existing.data.provider_payment_id, status: existing.data.status, qrCode: existing.data.pix_payload, qrCodeBase64: existing.data.pix_qr_code_base64, expiresAt: existing.data.pix_expiration_at, amountCents: existing.data.amount_cents, sellerId: existing.data.provider_seller_id, applicationFeeCents: 0, reused: true });

  const { data: seller } = await admin.from("driver_mercadopago_accounts").select("mercadopago_user_id,status").eq("driver_id", driverId).maybeSingle();
  if (!seller || seller.status !== "connected" || !seller.mercadopago_user_id) return json({ error: "driver_mercadopago_not_connected" }, 409);
  const { accessToken } = await loadSellerToken(admin, driverId);
  const fareCents = Number.isSafeInteger(Number(ride.fare_amount_cents)) && Number(ride.fare_amount_cents) > 0 ? Number(ride.fare_amount_cents) : Math.round(Number(ride.estimated_price) * 100);
  if (!Number.isSafeInteger(fareCents) || fareCents <= 0) return json({ error: "invalid_ride_amount" }, 500);

  const { data: attemptRows } = await admin.from("ride_pix_payments").select("attempt_number").eq("ride_id", rideId).order("attempt_number", { ascending: false }).limit(1);
  const attemptNumber = Number(attemptRows?.[0]?.attempt_number ?? 0) + 1;
  const externalReference = `apois-ride:${rideId}:attempt:${attemptNumber}`;
  const { data: paymentRow, error: insertError } = await admin.from("ride_pix_payments").insert({ ride_id: rideId, passenger_id: passenger.id, driver_id: driverId, provider: "mercadopago", amount_cents: fareCents, status: "creating", attempt_number: attemptNumber, external_reference: externalReference, provider_seller_id: seller.mercadopago_user_id, application_fee_cents: 0 }).select("id").single();
  if (insertError || !paymentRow) return json({ error: "payment_attempt_create_failed" }, 500);
  await admin.from("rides").update({ payment_provider: "mercadopago", fare_amount_cents: fareCents, processing_fee_cents: 0, passenger_charge_cents: fareCents, updated_at: new Date().toISOString() }).eq("id", rideId);

  const payerEmail = String(passenger.email || authData.user.email || "").trim();
  if (!payerEmail) return json({ error: "payer_email_required" }, 422);
  const payer: Record<string, unknown> = { email: payerEmail };
  const cpf = String(passenger.cpf ?? "").replace(/\D/g, "");
  if (cpf.length === 11) payer.identification = { type: "CPF", number: cpf };

  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", Authorization: `Bearer ${accessToken}`, "X-Idempotency-Key": paymentRow.id },
    body: JSON.stringify({ transaction_amount: fareCents / 100, description: `APOIS Corrida ${rideId.slice(0, 8)}`, payment_method_id: "pix", payer, external_reference: externalReference, application_fee: 0, notification_url: MP_WEBHOOK_URL, metadata: { ride_id: rideId, payment_attempt_id: paymentRow.id, apois_marketplace_fee_cents: 0 } }),
  });
  const body = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok || body.id == null) {
    console.error("[mercadopago-create-ride-pix] create failed", response.status, body);
    await admin.from("ride_pix_payments").update({ status: "failed", provider_status_detail: String(body.message ?? body.error ?? `http_${response.status}`), updated_at: new Date().toISOString() }).eq("id", paymentRow.id);
    return json({ error: "mercadopago_payment_create_failed" }, 502);
  }
  const tx = body.point_of_interaction?.transaction_data ?? {};
  const mappedStatus = body.status === "approved" ? "confirmed" : body.status === "cancelled" ? "cancelled" : body.status === "rejected" ? "failed" : "pending";
  await admin.from("ride_pix_payments").update({ provider_payment_id: String(body.id), status: mappedStatus, provider_status_detail: body.status_detail ? String(body.status_detail) : null, pix_payload: typeof tx.qr_code === "string" ? tx.qr_code : null, pix_qr_code_base64: typeof tx.qr_code_base64 === "string" ? tx.qr_code_base64 : null, pix_expiration_at: body.date_of_expiration || null, paid_at: body.status === "approved" ? (body.date_approved || new Date().toISOString()) : null, updated_at: new Date().toISOString() }).eq("id", paymentRow.id);
  await admin.from("rides").update({ provider_payment_id: String(body.id), payment_status: body.status === "approved" ? "paid" : "pending", payment_confirmed_at: body.status === "approved" ? (body.date_approved || new Date().toISOString()) : null, updated_at: new Date().toISOString() }).eq("id", rideId);
  return json({ provider: "mercadopago", paymentId: String(body.id), status: mappedStatus, qrCode: tx.qr_code ?? null, qrCodeBase64: tx.qr_code_base64 ?? null, ticketUrl: tx.ticket_url ?? null, expiresAt: body.date_of_expiration ?? null, amountCents: fareCents, fareCents, processingFeeCents: 0, passengerChargeCents: fareCents, sellerId: seller.mercadopago_user_id, applicationFeeCents: 0 });
});
