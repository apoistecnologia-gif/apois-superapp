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

function text(value: unknown, maxLength = 500): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

async function triggerRedispatch(rideId: string): Promise<{ ok: boolean; action?: string; status?: number }> {
  try {
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
  } catch (error) {
    // A RPC do motorista ja pode ter confirmado a rejeicao/cancelamento.
    // Devolver estado de redispatch adiado evita induzir o app a repetir a mutacao.
    console.error("[APOIS redispatch] network unavailable", error instanceof Error ? error.name : "unknown");
    return { ok: false, status: 0 };
  }
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
    const reason = text(body.reason, 500);
    // APOIS_REPORT07_CANCEL_REASON_CODE_V1: no-show is a stable code,
    // independent from the Portuguese label (also accept legacy clients).
    const normalized = reason.toLocaleLowerCase("pt-BR").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
    const inferredCode = ["passageiro nao apareceu", "passageiro nao compareceu", "no-show", "no show"].includes(normalized)
      ? "passenger_no_show" : "other";
    const reasonCode = text(body.reason_code, 40) || inferredCode;
    if (!["passenger_no_show", "other"].includes(reasonCode)) {
      return json(req, { error: "invalid_cancel_reason_code" }, 422);
    }
    if (!UUID_PATTERN.test(rideId)) return json(req, { error: "invalid_ride_id" }, 422);
    if (reason.length < 3) return json(req, { error: "driver_cancel_reason_required" }, 422);

    // Fail closed until the guarded SQL migration has committed. Otherwise
    // an accented no-show could silently take the ordinary cancellation path.
    if (reasonCode === "passenger_no_show") {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: contract, error: contractError } = await admin.from("app_settings")
        .select("value").eq("key", "ride.driver_no_show_code_v1").maybeSingle();
      if (contractError || contract?.value !== true) {
        return json(req, { error: "driver_no_show_contract_unavailable", ok: false }, 503);
      }
    }
    const rpcReason = reasonCode === "passenger_no_show"
      ? "APOIS_NO_SHOW_V1:" + reason : reason;

    // Executa a RPC com o JWT real do motorista. A própria RPC valida que a
    // corrida pertence a ele e que a transição/cancelamento é permitida.
    const driverClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: cancelledRide, error: cancelError } = await driverClient.rpc("driver_cancel_ride", {
      _ride_id: rideId,
      _reason: rpcReason,
    });
    if (cancelError) {
      return json(req, { error: cancelError.message || "driver_cancel_failed" }, 409);
    }

    const record = cancelledRide && typeof cancelledRide === "object"
      ? cancelledRide as Record<string, unknown>
      : {};
    const status = text(record.status, 50);

    // No-show após chegada encerra a corrida; cancelamento operacional comum
    // volta para procurar_motorista e precisa redispatch imediato, sem depender
    // de passageiro com app aberto ou de cron externo.
    if (status !== "procurar_motorista") {
      return json(req, { ok: true, ride: cancelledRide, redispatch: "not_required" });
    }

    const redispatch = await triggerRedispatch(rideId);
    if (!redispatch.ok) {
      console.error("[driver-cancel-redispatch] redispatch failed", {
        rideId,
        status: redispatch.status,
      });
      // O cancelamento já foi confirmado pelo banco. Não devolvemos erro que
      // faça o app tentar cancelar novamente; o passageiro continua vendo busca
      // e uma nova tentativa também pode ser feita pelo fluxo de recuperação.
      return json(req, {
        ok: true,
        ride: cancelledRide,
        redispatch: "deferred",
      });
    }

    return json(req, {
      ok: true,
      ride: cancelledRide,
      redispatch: redispatch.action ?? "triggered",
    });
  } catch (error) {
    console.error("[driver-cancel-redispatch] fatal", error);
    return json(req, { error: "internal_error" }, 500);
  }
});
