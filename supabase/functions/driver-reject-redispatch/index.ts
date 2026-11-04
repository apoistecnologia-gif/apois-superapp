import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "content-type": "application/json" },
  });
}

function bearer(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

function text(value: unknown, maxLength = 80): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

async function triggerRedispatch(rideId: string): Promise<{ ok: boolean; action?: string; status?: number }> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/dispatch-ride`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ride_id: rideId, mode: "redispatch" }),
  });
  const payload = await response.json().catch(() => ({})) as { action?: string };
  return { ok: response.ok, action: payload.action, status: response.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) return json(req, { error: "server_configuration_missing" }, 500);
    const token = bearer(req);
    if (!token) return json(req, { error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const rideId = text(body.ride_id, 50);
    if (!UUID_PATTERN.test(rideId)) return json(req, { error: "invalid_ride_id" }, 422);

    // A rejeição usa o JWT real do motorista, preservando todas as validações
    // e RLS/RPC existentes. Service role é usado somente para encadear dispatch.
    const driverClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: rejectedRide, error: rejectError } = await driverClient.rpc("driver_reject_ride", {
      _ride_id: rideId,
    });
    if (rejectError) {
      return json(req, { error: rejectError.message || "driver_reject_failed" }, 409);
    }

    const redispatch = await triggerRedispatch(rideId);
    if (!redispatch.ok) {
      console.error("[driver-reject-redispatch] redispatch failed", {
        rideId,
        status: redispatch.status,
      });
      // Rejeição já confirmada. Não faz o cliente repetir a RPC; uma rejeição
      // duplicada é pior que aguardar a próxima recuperação/redispatch.
      return json(req, { ok: true, ride: rejectedRide, redispatch: "deferred" });
    }

    return json(req, {
      ok: true,
      ride: rejectedRide,
      redispatch: redispatch.action ?? "triggered",
    });
  } catch (error) {
    console.error("[driver-reject-redispatch] fatal", error);
    return json(req, { error: "internal_error" }, 500);
  }
});
