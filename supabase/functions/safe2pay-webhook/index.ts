import { createClient } from "npm:@supabase/supabase-js@2.112.1";

const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : String(value ?? "").trim();
}
function number(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function safeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i] ^ b[i];
  return diff === 0;
}
function mappedStatus(code: string): "pending" | "processing" | "authorized" | "refunded" | "chargeback" | null {
  if (code === "1") return "pending";
  if (code === "2") return "processing";
  if (code === "3") return "authorized";
  if (code === "6") return "refunded";
  if (code === "13") return "chargeback";
  return null;
}
function shouldAdvance(current: string, next: string): boolean {
  const rank: Record<string, number> = {
    pending: 10,
    processing: 20,
    authorized: 30,
    expired: 40,
    failed: 40,
    refunded: 50,
    chargeback: 60,
  };
  if (current === "refunded" || current === "chargeback") return current === next;
  if (current === "authorized" && ["pending", "processing"].includes(next)) return false;
  return (rank[next] ?? 0) >= (rank[current] ?? 0);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const raw = await req.text();
  if (!raw || raw.length > 256_000) return json(413, { error: "invalid_payload_size" });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const configuredSecret = (Deno.env.get("SAFE2PAY_SECRET_KEY") ?? "").trim();
  const receivedSecret = text(payload.SecretKey);
  if (!configuredSecret || !receivedSecret || !safeEqual(receivedSecret, configuredSecret)) {
    return json(401, { error: "invalid_webhook_secret" });
  }

  const product = (Deno.env.get("SAFE2PAY_WEBHOOK_PRODUCT") ?? "").trim().toLowerCase();
  if (!["rides", "orders"].includes(product)) return json(500, { error: "webhook_product_not_configured" });

  const transactionId = number(payload.IdTransaction);
  const statusObject = payload.TransactionStatus && typeof payload.TransactionStatus === "object"
    ? payload.TransactionStatus as Record<string, unknown>
    : {};
  const statusCode = text(statusObject.Code ?? statusObject.Id);
  const reference = text(payload.Reference);
  const amount = number(payload.Amount);

  if (!transactionId || transactionId <= 0 || !statusCode || !reference || amount === null || amount < 0) {
    return json(400, { error: "invalid_webhook_payload" });
  }
  const expectedPrefix = product === "rides" ? "apois-ride-" : "apois-order-";
  if (!reference.startsWith(expectedPrefix)) return json(409, { error: "reference_product_mismatch" });

  const mapped = mappedStatus(statusCode);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRole) return json(500, { error: "server_configuration_missing" });
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const payloadHash = await sha256(raw);
  const { data: existingEvent } = await admin
    .from("safe2pay_webhook_events")
    .select("id,processed_at")
    .eq("provider_transaction_id", transactionId)
    .eq("transaction_status_code", statusCode)
    .maybeSingle();
  // Replay must verify the domain row; an old processed flag alone is not reconciliation proof.

  let eventId = existingEvent?.id ?? null;
  if (!eventId) {
    const inserted = await admin.from("safe2pay_webhook_events").insert({
      provider_transaction_id: transactionId,
      transaction_status_code: statusCode,
      payload_hash: payloadHash,
      event_key: "safe2pay:" + product + ":" + transactionId + ":" + statusCode,
    }).select("id").maybeSingle();
    if (inserted.error && inserted.error.code !== "23505") {
      return json(500, { error: "webhook_event_store_failed" });
    }
    eventId = inserted.data?.id ?? null;
    if (!eventId) {
      const retry = await admin.from("safe2pay_webhook_events")
        .select("id,processed_at")
        .eq("provider_transaction_id", transactionId)
        .eq("transaction_status_code", statusCode)
        .maybeSingle();
      // Re-enter reconciliation even for an event previously marked processed.
      eventId = retry.data?.id ?? null;
    }
  }

  if (!eventId) return json(500, { error: "webhook_event_id_missing" });

  if (!mapped) {
    if (eventId) await admin.from("safe2pay_webhook_events").update({
      processed_at: new Date().toISOString(),
      processing_error: `unsupported_status:${statusCode}`,
    }).eq("id", eventId);
    return json(202, { ok: true, ignored: true, statusCode });
  }

  const table = product === "rides" ? "safe2pay_ride_transactions" : "safe2pay_order_transactions";
  const tx = await admin.from(table)
    .select(product === "rides" ? "id,ride_id,reference,amount,status" : "id,order_id,reference,amount,status")
    .eq("provider_transaction_id", transactionId)
    .maybeSingle();

  if (tx.error || !tx.data) {
    if (eventId) await admin.from("safe2pay_webhook_events").update({ processing_error: "transaction_not_found" }).eq("id", eventId);
    return json(404, { error: "transaction_not_found" });
  }
  if (String(tx.data.reference) !== reference || Math.round(Number(tx.data.amount) * 100) !== Math.round(amount * 100)) {
    if (eventId) await admin.from("safe2pay_webhook_events").update({ processing_error: "transaction_mismatch" }).eq("id", eventId);
    return json(409, { error: "transaction_mismatch" });
  }

  const now = new Date().toISOString();
  const current = String(tx.data.status ?? "pending");
  // Non-atomic multi-table writes still require a transactional RPC before production release.
  if (shouldAdvance(current, mapped)) {
    const patch: Record<string, unknown> = { status: mapped, updated_at: now };
    if (mapped === "authorized") patch.authorized_at = now;
    if (mapped === "refunded") patch.refunded_at = now;
    const update = current === mapped
      ? { error: null, data: { id: tx.data.id } }
      : await admin.from(table).update(patch).eq("id", tx.data.id).eq("status", current).select("id").maybeSingle();
    if (update.error || !update.data) {
      if (eventId) await admin.from("safe2pay_webhook_events").update({ processing_error: "transaction_update_failed" }).eq("id", eventId);
      return json(500, { error: "transaction_update_failed" });
    }

    if (product === "rides") {
      const rideId = String((tx.data as Record<string, unknown>).ride_id ?? "");
      if (mapped === "authorized") {
        const rideUpdate = await admin.from("rides")
          .update({
            payment_status: "paid",
            payment_provider: "safe2pay",
            provider_payment_id: String(transactionId),
            payment_confirmed_at: now,
            updated_at: now,
          })
          .eq("id", rideId)
          .eq("payment_method", "pix")
          .neq("status", "finalizada")
          .neq("status", "cancelada_passageiro")
          .neq("status", "cancelada_motorista")
          .select("id").maybeSingle();
        if (rideUpdate.error || !rideUpdate.data) return json(500, { error: "ride_payment_update_failed_or_no_rows" });
      } else if (mapped === "refunded") {
        const rideUpdate = await admin.from("rides")
          .update({ payment_status: "refunded", payment_provider: "safe2pay", updated_at: now })
          .eq("id", rideId)
          .select("id").maybeSingle();
        if (rideUpdate.error || !rideUpdate.data) return json(500, { error: "ride_refund_update_failed_or_no_rows" });
      }
    }

    if (product === "orders") {
      const orderId = String((tx.data as Record<string, unknown>).order_id ?? "");
      if (mapped === "authorized") {
        const orderUpdate = await admin.from("orders")
          .update({ payment_status: "paid" })
          .eq("id", orderId)
          .neq("status", "cancelled")
          .neq("status", "refunded")
          .select("id").maybeSingle();
        if (orderUpdate.error || !orderUpdate.data) return json(500, { error: "order_payment_update_failed_or_no_rows" });
      } else if (mapped === "refunded") {
        const orderUpdate = await admin.from("orders")
          .update({ payment_status: "refunded" })
          .eq("id", orderId)
          .select("id").maybeSingle();
        if (orderUpdate.error || !orderUpdate.data) return json(500, { error: "order_refund_update_failed_or_no_rows" });
      }
    }
  }

  const completed = await admin.from("safe2pay_webhook_events").update({
    processed_at: now,
    processing_error: null,
  }).eq("id", eventId).select("id").maybeSingle();
  if (completed.error || !completed.data) return json(500, { error: "webhook_event_completion_failed" });
  return json(200, { ok: true, transactionId, status: mapped });
});
