import { createClient } from "npm:@supabase/supabase-js@2.112.1";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !anonKey || !serviceRole) return json(500, { error: "server_configuration_missing" });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "unauthorized" });
  const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await auth.auth.getUser(token);
  if (authError || !authData.user) return json(401, { error: "unauthorized" });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const resourceType = String(body.resource_type ?? "");
  const resourceId = String(body.resource_id ?? "");
  if (!["ride","order"].includes(resourceType) || !UUID_RE.test(resourceId)) return json(400, { error: "invalid_resource" });

  if (resourceType === "order") {
    const order = await admin.from("orders").select("id,customer_user_id,payment_status").eq("id", resourceId).eq("customer_user_id", authData.user.id).maybeSingle();
    if (order.error || !order.data) return json(404, { error: "order_not_found" });
    const tx = await admin.from("safe2pay_order_transactions").select("provider_transaction_id,status,amount,pix_copy_paste,pix_qr_code_base64,authorized_at,refunded_at,created_at").eq("order_id", resourceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (tx.error) return json(500, { error: "payment_lookup_failed" });
    return json(200, { resourceType, resourceId, paymentStatus: order.data.payment_status, transaction: tx.data ?? null });
  }

  const user = await admin.from("users").select("id").eq("auth_user_id", authData.user.id).maybeSingle();
  if (user.error || !user.data?.id) return json(404, { error: "passenger_profile_not_found" });
  const ride = await admin.from("rides").select("id,passenger_id").eq("id", resourceId).eq("passenger_id", user.data.id).maybeSingle();
  if (ride.error || !ride.data) return json(404, { error: "ride_not_found" });
  const tx = await admin.from("safe2pay_ride_transactions").select("provider_transaction_id,status,amount,authorized_at,refunded_at,created_at").eq("ride_id", resourceId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (tx.error) return json(500, { error: "payment_lookup_failed" });
  return json(200, { resourceType, resourceId, transaction: tx.data ?? null });
});
