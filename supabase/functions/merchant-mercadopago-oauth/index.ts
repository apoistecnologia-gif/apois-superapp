import { createClient } from "npm:@supabase/supabase-js@2.112.1";

type JsonRecord = Record<string, unknown>;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isRecord(v: unknown): v is JsonRecord { return typeof v === "object" && v !== null && !Array.isArray(v); }
function text(v: unknown): string | null { return typeof v === "string" && v.trim() ? v.trim() : null; }
function json(status: number, body: JsonRecord) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
function b64url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function b64(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)); }
function fromB64(value: string) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
async function sha256(value: string) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return b64url(new Uint8Array(d)); }
async function keyFromEnv() {
  const raw = Deno.env.get("MERCADO_PAGO_OAUTH_TOKEN_KEY_BASE64")?.trim();
  if (!raw) throw new Error("missing_token_key");
  const bytes = fromB64(raw);
  if (bytes.byteLength !== 32) throw new Error("invalid_token_key");
  return await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt","decrypt"]);
}
async function encrypt(value: string, key: CryptoKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, new TextEncoder().encode(value));
  return { value: b64(new Uint8Array(cipher)), iv: b64(iv) };
}
async function decrypt(value: string, iv: string, key: CryptoKey) {
  const clear = await crypto.subtle.decrypt({ name:"AES-GCM", iv: fromB64(iv) }, key, fromB64(value));
  return new TextDecoder().decode(clear);
}
function oauthConfig() {
  const clientId = Deno.env.get("MERCADO_PAGO_OAUTH_CLIENT_ID")?.trim() || Deno.env.get("MERCADO_PAGO_CLIENT_ID")?.trim();
  const clientSecret = Deno.env.get("MERCADO_PAGO_OAUTH_CLIENT_SECRET")?.trim() || Deno.env.get("MERCADO_PAGO_CLIENT_SECRET")?.trim();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/,"");
  const redirectUri = Deno.env.get("MERCADO_PAGO_MERCHANT_REDIRECT_URI")?.trim() || (supabaseUrl ? `${supabaseUrl}/functions/v1/merchant-mercadopago-callback` : null);
  return { clientId, clientSecret, redirectUri };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status:204, headers:cors });
  if (req.method !== "POST") return json(405,{ error:"method_not_allowed" });
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim();
  if (!auth) return json(401,{ error:"authentication_required" });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(500,{ error:"server_configuration" });
  const admin = createClient(supabaseUrl, serviceRole, { auth:{ persistSession:false, autoRefreshToken:false } });
  const { data:userData, error:userError } = await admin.auth.getUser(auth);
  const user = userData.user;
  if (userError || !user) return json(401,{ error:"invalid_session" });
  const payload = await req.json().catch(() => ({}));
  const action = isRecord(payload) ? (text(payload.action) ?? "status") : "status";

  const { data:member, error:memberError } = await admin.from("merchant_members").select("merchant_id,role,status").eq("user_id",user.id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (memberError) return json(500,{ error:"membership_lookup_failed" });
  if (!member) return json(403,{ error:"merchant_membership_required" });
  if (!new Set(["owner","admin","manager"]).has(String(member.role))) return json(403,{ error:"merchant_owner_required" });
  const merchantId = member.merchant_id;

  const readAccount = async () => {
    const { data } = await admin.from("merchant_mercadopago_accounts").select("id,merchant_id,provider_user_id,account_email,status,scope,access_token_expires_at,connected_at,disconnected_at,last_refreshed_at,updated_at").eq("merchant_id",merchantId).maybeSingle();
    return data;
  };

  if (action === "disconnect") {
    const now = new Date().toISOString();
    const { error } = await admin.from("merchant_mercadopago_accounts").update({
      encrypted_access_token:null,
      encrypted_refresh_token:null,
      token_iv:null,
      refresh_token_iv:null,
      access_token_expires_at:null,
      status:"revoked",
      disconnected_at:now,
      last_error:null,
      updated_at:now,
    }).eq("merchant_id",merchantId);
    if (error) return json(500,{ error:"disconnect_failed" });
    return json(200,{ ok:true, connected:false, status:"revoked" });
  }

  if (action === "status") {
    let account = await readAccount();
    if (account?.status === "connected" && account.access_token_expires_at && new Date(account.access_token_expires_at).getTime() < Date.now() + 7*24*3600*1000) {
      const full = await admin.from("merchant_mercadopago_accounts").select("*").eq("merchant_id",merchantId).maybeSingle();
      if (full.data?.encrypted_refresh_token && full.data?.refresh_token_iv) {
        try {
          const cfg = oauthConfig();
          if (!cfg.clientId || !cfg.clientSecret) throw new Error("oauth_credentials_missing");
          const key = await keyFromEnv();
          const refreshToken = await decrypt(full.data.encrypted_refresh_token, full.data.refresh_token_iv, key);
          const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", { method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"}, body:JSON.stringify({ client_id:cfg.clientId, client_secret:cfg.clientSecret, grant_type:"refresh_token", refresh_token:refreshToken }) });
          const raw = await tokenResponse.json().catch(() => null);
          if (!tokenResponse.ok || !isRecord(raw) || !text(raw.access_token)) throw new Error(`refresh_http_${tokenResponse.status}`);
          const access = await encrypt(text(raw.access_token)!, key);
          const newRefresh = text(raw.refresh_token) ? await encrypt(text(raw.refresh_token)!, key) : null;
          const expiresIn = Number(raw.expires_in ?? 15552000);
          const refreshedScope = text(raw.scope) ?? full.data.scope ?? null;
          await admin.from("merchant_mercadopago_accounts").update({ encrypted_access_token:access.value, token_iv:access.iv, encrypted_refresh_token:newRefresh?.value ?? full.data.encrypted_refresh_token, refresh_token_iv:newRefresh?.iv ?? full.data.refresh_token_iv, access_token_expires_at:new Date(Date.now()+Math.max(60,expiresIn)*1000).toISOString(), scope:refreshedScope, last_refreshed_at:new Date().toISOString(), status:"connected", disconnected_at:null, last_error:null, updated_at:new Date().toISOString() }).eq("id",full.data.id);
          account = await readAccount();
        } catch (e) {
          const msg = e instanceof Error ? e.message : "refresh_failed";
          await admin.from("merchant_mercadopago_accounts").update({ status:"refresh_required", last_error:msg, updated_at:new Date().toISOString() }).eq("merchant_id",merchantId);
          account = await readAccount();
        }
      } else {
        await admin.from("merchant_mercadopago_accounts").update({ status:"refresh_required", last_error:"refresh_token_missing", updated_at:new Date().toISOString() }).eq("merchant_id",merchantId);
        account = await readAccount();
      }
    }
    return json(200,{ ok:true, connected:account?.status === "connected", account: account ? { providerUserId:account.provider_user_id, email:account.account_email, status:account.status, expiresAt:account.access_token_expires_at, connectedAt:account.connected_at, disconnectedAt:account.disconnected_at, lastRefreshedAt:account.last_refreshed_at } : null });
  }

  if (action !== "start") return json(400,{ error:"invalid_action" });
  const cfg = oauthConfig();
  if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) return json(503,{ error:"mercadopago_oauth_not_configured", required:["MERCADO_PAGO_OAUTH_CLIENT_ID","MERCADO_PAGO_OAUTH_CLIENT_SECRET","MERCADO_PAGO_OAUTH_TOKEN_KEY_BASE64","MERCADO_PAGO_MERCHANT_REDIRECT_URI"] });
  if (!cfg.redirectUri.startsWith("https://")) return json(503,{ error:"mercadopago_oauth_redirect_must_be_https" });
  let key: CryptoKey;
  try { key = await keyFromEnv(); } catch { return json(503,{ error:"mercadopago_oauth_encryption_not_configured" }); }

  const state = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(64))).slice(0,96);
  const challenge = await sha256(verifier);
  const verifierEnc = await encrypt(verifier,key);
  const stateHash = await sha256(state);
  await admin.from("merchant_mercadopago_oauth_states").delete().eq("merchant_id",merchantId).is("used_at",null);
  const { error:insertError } = await admin.from("merchant_mercadopago_oauth_states").insert({ merchant_id:merchantId, user_id:user.id, state_hash:stateHash, code_verifier_encrypted:verifierEnc.value, code_verifier_iv:verifierEnc.iv, expires_at:new Date(Date.now()+10*60*1000).toISOString() });
  if (insertError) return json(500,{ error:"oauth_state_create_failed" });
  const url = new URL("https://auth.mercadopago.com.br/authorization");
  url.searchParams.set("client_id",cfg.clientId);
  url.searchParams.set("response_type","code");
  url.searchParams.set("platform_id","mp");
  url.searchParams.set("state",state);
  url.searchParams.set("redirect_uri",cfg.redirectUri);
  url.searchParams.set("scope","offline_access");
  url.searchParams.set("code_challenge",challenge);
  url.searchParams.set("code_challenge_method","S256");
  return json(200,{ ok:true, authorizationUrl:url.toString(), expiresInSeconds:600 });
});
