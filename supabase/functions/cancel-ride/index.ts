import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error_code: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const authorization = req.headers.get("authorization") ?? "";

    const authClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    const authUser = authData.user;
    if (authError || !authUser) return json({ ok: false, error_code: "unauthorized" }, 401);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: passenger, error: passengerError } = await admin
      .from("users")
      .select("id")
      .eq("auth_user_id", authUser.id)
      .maybeSingle();
    if (passengerError) throw passengerError;
    if (!passenger) return json({ ok: false, error_code: "passenger_not_found" }, 404);

    const body = await req.json();
    const rideId = String(body?.ride_id ?? "").trim();
    if (!rideId) return json({ ok: false, error_code: "invalid_ride_id" }, 422);

    const { data: ride, error: rideError } = await admin
      .from("rides")
      .select("id,passenger_id,status")
      .eq("id", rideId)
      .maybeSingle();
    if (rideError) throw rideError;
    if (!ride) return json({ ok: false, error_code: "ride_not_found" }, 404);
    if (String(ride.passenger_id) !== String(passenger.id)) return json({ ok: false, error_code: "unauthorized" }, 403);

    const status = String(ride.status ?? "");
    if (["finalizada", "cancelada_passageiro", "cancelada_motorista"].includes(status)) {
      return json({ ok: true, status, cancellation_fee: 0 });
    }
    if (!["procurar_motorista", "motorista_a_caminho", "agendada"].includes(status)) {
      return json({ ok: false, error_code: "cancellation_not_allowed", status }, 409);
    }

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("rides")
      .update({
        status: "cancelada_passageiro",
        cancelled_by: String(passenger.id),
        cancellation_reason: "Cancelada pelo passageiro",
        cancellation_fee: 0,
        cancelled_at: now,
        updated_at: now,
        candidate_driver_ids: [],
        offered_driver_ids: [],
        request_expires_at: null,
        search_expires_at: null
      })
      .eq("id", rideId)
      .eq("passenger_id", passenger.id)
      .in("status", ["procurar_motorista", "motorista_a_caminho", "agendada"])
      .select("id,status,cancellation_fee")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!updated) return json({ ok: false, error_code: "ride_status_changed" }, 409);

    return json({ ok: true, status: "cancelada_passageiro", cancellation_fee: 0, message: "Corrida cancelada sem taxa." });
  } catch (error) {
    console.error("[cancel-ride]", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error_code: "internal_error", message: "Não foi possível cancelar a corrida." }, 500);
  }
});