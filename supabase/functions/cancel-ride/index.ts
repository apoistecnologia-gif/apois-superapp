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
    const client = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("authorization") ?? "" } } },
    );

    const body = await req.json();
    const rideId = String(body?.ride_id ?? "").trim();
    if (!rideId) return json({ ok: false, error_code: "invalid_ride_id" }, 422);

    const { data, error } = await client.rpc("cancel_own_ride", { p_ride_id: rideId });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return json({ ok: false, error_code: "empty_response" }, 500);

    return json(
      {
        ok: Boolean(row.ok),
        status: row.status,
        cancellation_fee: Number(row.cancellation_fee ?? 0),
        message: row.message,
      },
      row.ok ? 200 : 409,
    );
  } catch (error) {
    console.error("[cancel-ride]", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error_code: "internal_error", message: "Não foi possível cancelar a corrida." }, 500);
  }
});