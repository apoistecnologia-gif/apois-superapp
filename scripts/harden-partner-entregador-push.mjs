import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/lib/courier-push.ts');
let source = readFileSync(path, 'utf8');

const oldRpc = '(supabase.rpc as any)("register_courier_push_device", {\n    _token: normalized,\n    _platform: "android",\n  })';
const newRpc = '(supabase.rpc as any)("register_courier_push_device_v2", {\n    _token: normalized,\n    _platform: "android",\n    _app_package: "br.com.apois.parceiro",\n  })';
if (source.includes(oldRpc)) source = source.replace(oldRpc, newRpc);
if (!source.includes(newRpc)) throw new Error('Entregador Parceiro: registro Push não usa package br.com.apois.parceiro.');

const channelMarker = 'const REGISTRATION_TIMEOUT_MS = 12_000;';
const channelReplacement = `const REGISTRATION_TIMEOUT_MS = 12_000;
const PARTNER_PENDING_PUSH_KEY = "apois-parceiro:pending-push";

function isRidePushPayload(data: Record<string, unknown> | null | undefined) {
  if (!data) return false;
  const rideId = String(data["ride_id"] ?? data["rideId"] ?? "").trim();
  const event = String(data["event"] ?? "").trim().toLowerCase();
  return Boolean(rideId) || event.startsWith("ride.") || event.startsWith("driver.") || event.includes("corrida");
}

function isDeliveryPushPayload(data: Record<string, unknown> | null | undefined) {
  if (!data) return false;
  const orderId = String(data["orderId"] ?? data["order_id"] ?? data["orderID"] ?? "").trim();
  const type = String(data["notificationType"] ?? data["notification_type"] ?? "").trim().toLowerCase();
  return Boolean(orderId) || type.includes("delivery") || type.includes("order");
}

function forwardPartnerPush(data: Record<string, unknown> | null | undefined) {
  try { sessionStorage.setItem(PARTNER_PENDING_PUSH_KEY, JSON.stringify(data ?? {})); } catch {}
  window.location.replace("../../index.html");
}`;
if (source.includes(channelMarker) && !source.includes('PARTNER_PENDING_PUSH_KEY')) {
  source = source.replace(channelMarker, channelReplacement);
}

const oldAction = `      (action) => {
        emitCourierPush(action.notification);
        if (window.location.pathname !== "/courier") window.location.assign("/courier");
      },`;
const newAction = `      (action) => {
        const data = (action.notification?.data ?? null) as Record<string, unknown> | null;
        if (isRidePushPayload(data)) {
          forwardPartnerPush(data);
          return;
        }
        if (!isDeliveryPushPayload(data)) return;
        emitCourierPush(action.notification);
        window.dispatchEvent(new CustomEvent("apois:courier-push-open", { detail: data }));
      },`;
if (source.includes(oldAction)) source = source.replace(oldAction, newAction);
if (source.includes('window.location.assign("/courier")')) throw new Error('Entregador Parceiro: navegação Push absoluta /courier permaneceu no bundle.');

// O token FCM pertence ao APK br.com.apois.parceiro, não a um módulo web.
// Sair apenas do perfil Entregador deve remover o vínculo no backend Entregas,
// mas NÃO pode chamar PushNotifications.unregister(), pois isso derrubaria
// também as notificações do Motorista no mesmo APK.
const unregisterBlock = `  // Always unregister the local FCM installation, even when the backend is
  // temporarily unreachable. This prevents a signed-out device from continuing
  // to present a live local registration while server cleanup is retried later.
  try {
    await PushNotifications.unregister();
  } catch (error) {
    console.warn(
      "courier local push unregister failed",
      error instanceof Error ? error.message : "unknown",
    );
  }

`;
if (source.includes(unregisterBlock)) source = source.replace(unregisterBlock, '');
if (source.includes('PushNotifications.unregister()')) throw new Error('Entregador Parceiro: logout ainda desregistra token FCM compartilhado.');

for (const marker of [
  'register_courier_push_device_v2',
  '_app_package: "br.com.apois.parceiro"',
  'PARTNER_PENDING_PUSH_KEY',
  'isRidePushPayload(data)',
  'isDeliveryPushPayload(data)',
  'forwardPartnerPush(data)',
]) {
  if (!source.includes(marker)) throw new Error(`Entregador Parceiro: isolamento Push incompleto (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: FCM usa package próprio, payloads cruzados vão ao shell e logout não desregistra token compartilhado.');
