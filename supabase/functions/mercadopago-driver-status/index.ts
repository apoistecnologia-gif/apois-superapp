import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return json(req, { error: "server_configuration_missing" }, 500);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(req, { error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json(req, { error: "unauthorized" }, 401);

  const { data: user, error: userError } = await admin
    .from("users")
    .select("id,deleted_at")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (userError) return json(req, { error: "user_lookup_failed" }, 500);
  if (!user || user.deleted_at) return json(req, { error: "user_not_found" }, 404);

  const { data: driver, error: driverError } = await admin
    .from("drivers")
    .select("id,approval_status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (driverError) return json(req, { error: "driver_lookup_failed" }, 500);
  if (!driver) return json(req, { error: "driver_profile_required" }, 404);

  const { data: account, error: accountError } = await admin
    .from("driver_mercadopago_accounts")
    .select("status,mercadopago_user_id,live_mode,scopes,connected_at,token_expires_at,last_error")
    .eq("driver_id", driver.id)
    .maybeSingle();
  if (accountError) return json(req, { error: "mercadopago_account_lookup_failed" }, 500);

  return json(req, {
    ok: true,
    connected: account?.status === "connected",
    status: account?.status ?? "not_connected",
    mercadopagoUserId: account?.mercadopago_user_id ?? null,
    liveMode: account?.live_mode === true,
    scopes: Array.isArray(account?.scopes) ? account.scopes : [],
    connectedAt: account?.connected_at ?? null,
    tokenExpiresAt: account?.token_expires_at ?? null,
    lastError: account?.last_error ?? null,
    driverApprovalStatus: driver.approval_status,
  });
});
