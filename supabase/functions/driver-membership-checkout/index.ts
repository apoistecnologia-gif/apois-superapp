import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON_KEY) return json(req, { error: "server_configuration_missing" }, 500);

  const authorization = (req.headers.get("Authorization") ?? "").trim();
  if (!authorization) return json(req, { error: "unauthorized" }, 401);

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: setting, error: settingError } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "finance.target_electronic_payment_provider")
      .maybeSingle();
    if (settingError) throw new Error(`provider_setting_failed:${settingError.message}`);

    const provider = String(setting?.value ?? "asaas").replace(/^"|"$/g, "").trim().toLowerCase();
    const target = provider === "mercadopago"
      ? "mercadopago-create-driver-membership"
      : "asaas-create-driver-membership";

    const rawBody = await req.text();
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${target}`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        apikey: ANON_KEY,
        "content-type": "application/json",
      },
      body: rawBody || "{}",
    });

    const raw = await response.text();
    let payload: Record<string, unknown> = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      return json(req, { error: "membership_provider_invalid_response", provider }, 502);
    }

    return json(req, { ...payload, provider }, response.status);
  } catch (error) {
    console.error("[driver-membership-checkout]", error);
    return json(req, { error: "driver_membership_checkout_failed" }, 500);
  }
});
