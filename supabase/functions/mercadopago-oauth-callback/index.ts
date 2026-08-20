import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MP_CLIENT_ID = Deno.env.get("MERCADOPAGO_CLIENT_ID") ?? "";
const MP_CLIENT_SECRET = Deno.env.get("MERCADOPAGO_CLIENT_SECRET") ?? "";
const TOKEN_KEY_B64 = Deno.env.get("MERCADOPAGO_TOKEN_ENCRYPTION_KEY") ?? "";
const APP_RETURN_URL = Deno.env.get("MERCADOPAGO_APP_RETURN_URL") || "br.com.apois.app://auth/mercadopago";

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function b64(bytes: Uint8Array) { let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte); return btoa(binary); }
function fromB64(value: string) { const binary = atob(value); return Uint8Array.from(binary, (ch) => ch.charCodeAt(0)); }
async function encrypt(value: string) {
  const raw = fromB64(TOKEN_KEY_B64);
  if (raw.length !== 32) throw new Error("invalid_encryption_key");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  const packed = new Uint8Array(iv.length + ciphertext.length); packed.set(iv, 0); packed.set(ciphertext, iv.length); return b64(packed);
}
function redirect(status: string, detail?: string) {
  const url = new URL(APP_RETURN_URL); url.searchParams.set("status", status); if (detail) url.searchParams.set("detail", detail.slice(0, 120)); return Response.redirect(url.toString(), 302);
}

Deno.serve(async (req) => {
  if (req.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_CLIENT_ID || !MP_CLIENT_SECRET || !TOKEN_KEY_B64) return redirect("error", "configuration_missing");
  const requestUrl = new URL(req.url);
  const code = (requestUrl.searchParams.get("code") ?? "").trim();
  const state = (requestUrl.searchParams.get("state") ?? "").trim();
  if (!code || !state) return redirect("error", "missing_code_or_state");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
  const stateHash = await sha256Hex(state);
  const { data: oauthState, error: stateError } = await admin.from("mercadopago_oauth_states").select("id,driver_id,redirect_uri,expires_at,consumed_at").eq("state_hash", stateHash).maybeSingle();
  if (stateError || !oauthState) return redirect("error", "invalid_state");
  if (oauthState.consumed_at) return redirect("error", "state_already_used");
  if (new Date(oauthState.expires_at).getTime() <= Date.now()) return redirect("error", "state_expired");

  const form = new URLSearchParams({ client_id: MP_CLIENT_ID, client_secret: MP_CLIENT_SECRET, grant_type: "authorization_code", code, redirect_uri: oauthState.redirect_uri, state });
  const tokenResponse = await fetch("https://api.mercadopago.com/oauth/token", { method: "POST", headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" }, body: form });
  const tokenBody = await tokenResponse.json().catch(() => ({})) as Record<string, unknown>;
  if (!tokenResponse.ok || typeof tokenBody.access_token !== "string" || typeof tokenBody.refresh_token !== "string") {
    console.error("[mercadopago-oauth-callback] token exchange failed", tokenResponse.status, tokenBody); return redirect("error", "token_exchange_failed");
  }

  const expiresIn = Number(tokenBody.expires_in ?? 0);
  const tokenExpiresAt = Number.isFinite(expiresIn) && expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null;
  const scope = typeof tokenBody.scope === "string" ? tokenBody.scope.split(/\s+/).filter(Boolean) : [];
  const { error: credentialsError } = await admin.from("driver_mercadopago_credentials").upsert({
    driver_id: oauthState.driver_id,
    access_token_ciphertext: await encrypt(tokenBody.access_token),
    refresh_token_ciphertext: await encrypt(tokenBody.refresh_token),
    encryption_key_version: 1,
    updated_at: new Date().toISOString(),
  });
  if (credentialsError) return redirect("error", "credential_store_failed");

  const { error: accountError } = await admin.from("driver_mercadopago_accounts").upsert({
    driver_id: oauthState.driver_id,
    mercadopago_user_id: tokenBody.user_id != null ? String(tokenBody.user_id) : null,
    public_key: typeof tokenBody.public_key === "string" ? tokenBody.public_key : null,
    live_mode: tokenBody.live_mode === true,
    scopes: scope,
    status: "connected",
    token_expires_at: tokenExpiresAt,
    connected_at: new Date().toISOString(),
    refreshed_at: new Date().toISOString(),
    disconnected_at: null,
    last_error: null,
    updated_at: new Date().toISOString(),
  });
  if (accountError) return redirect("error", "account_store_failed");
  await admin.from("mercadopago_oauth_states").update({ consumed_at: new Date().toISOString() }).eq("id", oauthState.id);
  return redirect("connected");
});
