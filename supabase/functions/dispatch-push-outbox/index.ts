import { createClient } from "npm:@supabase/supabase-js@2.112.1";

type JsonRecord = Record<string, unknown>;
type Device = { id: string; platform: string; token: string; appProduct?: string; appPackage?: string };
type ClaimedPush = {
  outbox_id: string;
  notification_id: string;
  user_id: string;
  title: string;
  body: string;
  data: JsonRecord | null;
  notification_type: string;
  attempt_count: number;
  devices: Device[];
};
type CachedToken = { value: string; expiresAt: number };

const jsonHeaders = { "Content-Type": "application/json; charset=utf-8" };
const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const LEGACY_COURIER_PACKAGE = "br.com.apois.entregador";
const PARTNER_PACKAGE = "br.com.apois.parceiro";
const CUSTOMER_PACKAGE = "br.com.apois.cliente";
const SUPERAPP_PACKAGE = "br.com.apois.app";
const DELIVERY_CHANNEL_ID = "delivery_offers_v2";
const CUSTOMER_CHANNEL_ID = "order_updates";
let cachedAccessToken: CachedToken | null = null;

function response(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}
function env(name: string) { return Deno.env.get(name)?.trim() ?? ""; }
function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function base64UrlText(value: string) { return base64Url(new TextEncoder().encode(value)); }
function pemToPkcs8(value: string) {
  const normalized = value.replace(/\\n/g, "\n");
  const base64 = normalized.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replace(/\s+/g, "");
  if (!base64) throw new Error("FIREBASE_PRIVATE_KEY is invalid.");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}
async function createServiceAccountJwt(clientEmail: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlText(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlText(JSON.stringify({ iss: clientEmail, scope: FCM_SCOPE, aud: OAUTH_TOKEN_URL, iat: now, exp: now + 3600 }));
  const unsigned = `${header}.${payload}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToPkcs8(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  return `${unsigned}.${base64Url(new Uint8Array(signature))}`;
}
async function getAccessToken(clientEmail: string, privateKey: string) {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value;
  const assertion = await createServiceAccountJwt(clientEmail, privateKey);
  const body = new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion });
  const tokenResponse = await fetch(OAUTH_TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  const payload = (await tokenResponse.json().catch(() => null)) as JsonRecord | null;
  const accessToken = typeof payload?.["access_token"] === "string" ? payload["access_token"] : "";
  const expiresIn = Number(payload?.["expires_in"] ?? 3600);
  if (!tokenResponse.ok || !accessToken) throw new Error(`Firebase OAuth failed (${tokenResponse.status})`);
  cachedAccessToken = { value: accessToken, expiresAt: Date.now() + Math.max(300, expiresIn) * 1000 };
  return accessToken;
}
function stringifyData(value: JsonRecord | null, notificationId: string, notificationType: string) {
  const output: Record<string, string> = { notificationId, notificationType };
  if (!value) return output;
  for (const [key, raw] of Object.entries(value)) {
    if (raw === null || raw === undefined) continue;
    output[key] = typeof raw === "string" ? raw : JSON.stringify(raw);
  }
  return output;
}
function androidTarget(device: Device) {
  const requestedPackage = typeof device.appPackage === "string" ? device.appPackage.trim() : "";
  if (device.appProduct === "courier") {
    const packageName = requestedPackage === PARTNER_PACKAGE ? PARTNER_PACKAGE : LEGACY_COURIER_PACKAGE;
    return { packageName, channelId: DELIVERY_CHANNEL_ID, courier: true };
  }
  const packageName = requestedPackage === SUPERAPP_PACKAGE ? SUPERAPP_PACKAGE : CUSTOMER_PACKAGE;
  return { packageName, channelId: CUSTOMER_CHANNEL_ID, courier: false };
}
async function sendAndroidPush(projectId: string, accessToken: string, push: ClaimedPush, device: Device) {
  const target = androidTarget(device);
  const urgent = target.courier && push.notification_type === "delivery_offer";
  const providerResponse = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: {
      token: device.token,
      notification: { title: push.title, body: push.body },
      data: stringifyData(push.data, push.notification_id, push.notification_type),
      android: {
        priority: urgent ? "high" : "normal",
        ttl: urgent ? "90s" : "3600s",
        restricted_package_name: target.packageName,
        notification: {
          channel_id: target.channelId,
          default_sound: true,
          default_vibrate_timings: true,
          notification_priority: urgent ? "PRIORITY_MAX" : "PRIORITY_HIGH",
          visibility: "PUBLIC",
          tag: urgent ? `delivery-offer-${push.notification_id}` : `apois-${target.courier ? "courier" : "customer"}-${push.notification_id}`,
        },
      },
    } }),
  });
  const providerPayload = (await providerResponse.json().catch(() => null)) as JsonRecord | null;
  if (providerResponse.ok) return { ok: true, permanent: false, error: "" };
  const error = providerPayload?.["error"] as JsonRecord | undefined;
  const details = Array.isArray(error?.["details"]) ? (error?.["details"] as JsonRecord[]) : [];
  const fcmDetail = details.find((detail) => String(detail?.["@type"] ?? "").includes("FcmError"));
  const errorCode = String(fcmDetail?.["errorCode"] ?? error?.["status"] ?? "UNKNOWN");
  return { ok: false, permanent: errorCode === "UNREGISTERED" || errorCode === "SENDER_ID_MISMATCH", error: `FCM ${providerResponse.status} ${errorCode}` };
}
function retryAt(attempt: number) {
  const minutes = attempt <= 1 ? 1 : attempt === 2 ? 5 : attempt === 3 ? 15 : 60;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return response(405, { error: "method_not_allowed" });
  const suppliedDispatchKey = req.headers.get("x-apois-push-dispatch-key")?.trim() ?? "";
  if (!suppliedDispatchKey) return response(401, { error: "invalid_dispatch_key" });
  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const firebaseProjectId = env("FIREBASE_PROJECT_ID");
  const firebaseClientEmail = env("FIREBASE_CLIENT_EMAIL");
  const firebasePrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey || !firebaseProjectId || !firebaseClientEmail || !firebasePrivateKey) return response(503, { error: "firebase_server_credentials_not_configured" });
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: dispatchKeyValid, error: dispatchKeyError } = await supabase.rpc("verify_push_dispatch_runtime_key", { _candidate: suppliedDispatchKey });
  if (dispatchKeyError || dispatchKeyValid !== true) return response(401, { error: "invalid_dispatch_key" });
  const { data: claimed, error: claimError } = await supabase.rpc("claim_notification_push_batch_v2", { _limit: 25 });
  if (claimError) return response(500, { error: "push_claim_failed", detail: claimError.message });
  const pushes = Array.isArray(claimed) ? (claimed as ClaimedPush[]) : [];
  if (pushes.length === 0) return response(200, { processed: 0, sent: 0, failed: 0 });
  let accessToken: string;
  try { accessToken = await getAccessToken(firebaseClientEmail, firebasePrivateKey); }
  catch (error) {
    const message = error instanceof Error ? error.message : "Firebase OAuth failed.";
    for (const push of pushes) await supabase.from("notification_push_outbox").update({ status: "failed", last_error: message, next_attempt_at: retryAt(push.attempt_count), updated_at: new Date().toISOString() }).eq("id", push.outbox_id);
    return response(502, { error: "firebase_oauth_failed", detail: message });
  }
  let sent = 0, failed = 0, discarded = 0;
  for (const push of pushes) {
    const androidDevices = (push.devices ?? []).filter((device) => device.platform === "android" && (device.appProduct === "customer" || device.appProduct === "courier") && typeof device.token === "string" && device.token.trim());
    if (androidDevices.length === 0) {
      await supabase.from("notification_push_outbox").update({ status: "discarded", last_error: "no_active_android_device", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", push.outbox_id);
      discarded += 1; continue;
    }
    let successes = 0, permanentFailures = 0;
    const errors: string[] = [];
    for (const device of androidDevices) {
      const result = await sendAndroidPush(firebaseProjectId, accessToken, push, device);
      if (result.ok) { successes += 1; continue; }
      errors.push(result.error);
      if (result.permanent) {
        permanentFailures += 1;
        await supabase.from("push_devices").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", device.id);
      }
    }
    if (successes > 0) {
      await supabase.from("notification_push_outbox").update({ status: "sent", last_error: errors.length ? errors.join("; ").slice(0, 1000) : null, processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", push.outbox_id); sent += 1;
    } else if (permanentFailures === androidDevices.length) {
      await supabase.from("notification_push_outbox").update({ status: "discarded", last_error: errors.join("; ").slice(0, 1000) || "all_devices_invalid", processed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", push.outbox_id); discarded += 1;
    } else {
      await supabase.from("notification_push_outbox").update({ status: "failed", last_error: errors.join("; ").slice(0, 1000) || "fcm_send_failed", next_attempt_at: retryAt(push.attempt_count), updated_at: new Date().toISOString() }).eq("id", push.outbox_id); failed += 1;
    }
  }
  return response(200, { processed: pushes.length, sent, failed, discarded });
});
