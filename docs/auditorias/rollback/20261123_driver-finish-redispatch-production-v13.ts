import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const authorization = req.headers.get("authorization") ?? "";
    if (!authorization) return json({ ok: false, error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authorization } } },
    );

    const body = await req.json();
    const rideId = String(body?.ride_id ?? "").trim();
    if (!rideId) return json({ ok: false, error: "invalid_ride_id" }, 422);

    const { data, error } = await supabase.rpc("driver_finish_ride", { _ride_id: rideId });
    if (error) return json({ ok: false, error: error.message || "driver_finish_failed" }, 409);

    return json({ ok: true, ride: data });
  } catch (error) {
    console.error("[driver-finish-redispatch]", error instanceof Error ? error.message : "unknown");
    return json({ ok: false, error: "internal_error" }, 500);
  }
});