import { createClient } from "npm:@supabase/supabase-js@2.112.1";

// APOIS_SAFE2PAY_ATOMIC_RPC_V1 — REVIEW/QA ONLY, NOT DEPLOYED.
// Requires database/review/20261103_safe2pay_{corridas,entregas}_atomic_REVIEW_ONLY.sql,
// an approved transactional migration, and isolated PG/integration signoff BEFORE deployment.
const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}
function number(value: unknown): number | null {
  // Number(null), Number("") and Number(false) return zero: reject missing or non-numeric callback fields.
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?$/.test(value.trim())) return null;
  const n = Number(value);
  return Number.isFinite(n) && Number.isSafeInteger(Math.round(n * 100)) ? n : null;
}
function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
async function sha256(raw: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const raw = await req.text();
  if (!raw || raw.length > 256_000) return json(413, { error: "invalid_payload_size" });
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json(400, { error: "invalid_json_object" });
    payload = parsed as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const expectedSecret = (Deno.env.get("SAFE2PAY_SECRET_KEY") ?? "").trim();
  if (!expectedSecret || !safeEqual(text(payload.SecretKey), expectedSecret)) {
    return json(401, { error: "invalid_webhook_secret" });
  }
  const product = (Deno.env.get("SAFE2PAY_WEBHOOK_PRODUCT") ?? "").trim().toLowerCase();
  if (product !== "rides" && product !== "orders") return json(500, { error: "webhook_product_not_configured" });

  const transactionId = number(payload.IdTransaction);
  const statusObject = payload.TransactionStatus && typeof payload.TransactionStatus === "object"
    ? payload.TransactionStatus as Record<string, unknown> : {};
  const statusCode = text(statusObject.Code ?? statusObject.Id);
  const reference = text(payload.Reference);
  const amount = number(payload.Amount);
  if (!transactionId || !Number.isSafeInteger(transactionId) || transactionId <= 0 ||
      !/^[0-9]{1,3}$/.test(statusCode) || !reference || reference.length > 256 ||
      amount === null || amount < 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
    return json(400, { error: "invalid_webhook_payload" });
  }
  const prefix = product === "rides" ? "apois-ride-" : "apois-order-";
  if (!reference.startsWith(prefix)) return json(409, { error: "reference_product_mismatch" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRole) return json(500, { error: "server_configuration_missing" });
  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Exactly ONE Data API RPC. No intermediate transaction, order/ride or event table writes here.
  // Failure (including a missing migration) returns non-2xx; the provider can retry safely.
  const result = await admin.rpc("apois_safe2pay_apply_event_atomic", {
    _provider_transaction_id: transactionId,
    _status_code: statusCode,
    _reference: reference,
    _amount: Math.round(amount * 100) / 100,
    _payload_hash: await sha256(raw),
  });
  if (result.error) return json(503, { error: "atomic_reconciliation_not_confirmed" });
  const outcome = result.data as Record<string, unknown> | null;
  if (!outcome || typeof outcome !== "object") return json(503, { error: "invalid_atomic_response" });
  if (outcome.manual_review === true) {
    return json(503, { ok: false, manual_review: true, reason: outcome.reason ?? "manual_review" });
  }
  if (outcome.ok !== true) return json(503, { error: "atomic_reconciliation_not_confirmed" });
  return json(outcome.ignored === true ? 202 : 200, {
    ok: true, transactionId, status: outcome.status ?? null,
    ignored: outcome.ignored === true,
  });
});
