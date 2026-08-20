import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_CLIENT_ID = Deno.env.get("MERCADOPAGO_CLIENT_ID") ?? "";
const MP_REDIRECT_URI = Deno.env.get("MERCADOPAGO_OAUTH_REDIRECT_URI") || `${SUPABASE_URL}/functions/v1/mercadopago-oauth-callback`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_CLIENT_ID || !MP_REDIRECT_URI) return json({ error: "mercadopago_configuration_missing" }, 503);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json({ error: "unauthorized" }, 401);

  const { data: user, error: userError } = await admin.from("users").select("id,deleted_at").eq("auth_user_id", authData.user.id).maybeSingle();
  if (userError) return json({ error: "user_lookup_failed" }, 500);
  if (!user || user.deleted_at) return json({ error: "user_not_found" }, 404);

  const { data: driver, error: driverError } = await admin.from("drivers").select("id,approval_status").eq("user_id", user.id).maybeSingle();
  if (driverError) return json({ error: "driver_lookup_failed" }, 500);
  if (!driver) return json({ error: "driver_profile_required" }, 403);

  const state = `${crypto.randomUUID()}-${crypto.randomUUID()}`;
  const stateHash = await sha256Hex(state);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: stateError } = await admin.from("mercadopago_oauth_states").insert({ driver_id: driver.id, state_hash: stateHash, redirect_uri: MP_REDIRECT_URI, expires_at: expiresAt });
  if (stateError) return json({ error: "oauth_state_create_failed" }, 500);

  const url = new URL("https://auth.mercadopago.com.br/authorization");
  url.searchParams.set("client_id", MP_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", MP_REDIRECT_URI);
  url.searchParams.set("state", state);
  return json({ authorizationUrl: url.toString(), expiresAt });
});
