import './harden-partner-motorista-payment-policy.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/lib/nativeBridge.ts');
let source = readFileSync(path, 'utf8');

const oldPushType = `type PushData = {
  url?: string;
  event?: string;
  ride_id?: string;
};`;
const newPushType = `type PushData = {
  url?: string;
  event?: string;
  ride_id?: string;
  rideId?: string;
  orderId?: string;
  order_id?: string;
  notificationType?: string;
  notification_type?: string;
};

const PARTNER_PENDING_PUSH_KEY = "apois-parceiro:pending-push";

function isDeliveryPush(data: PushData | undefined): boolean {
  if (!data) return false;
  const orderId = String(data.orderId ?? data.order_id ?? "").trim();
  const type = String(data.notificationType ?? data.notification_type ?? "").trim().toLowerCase();
  return Boolean(orderId) || type.includes("delivery") || type.includes("order");
}

function isRidePush(data: PushData | undefined): boolean {
  if (!data) return false;
  const rideId = String(data.ride_id ?? data.rideId ?? "").trim();
  const event = String(data.event ?? "").trim().toLowerCase();
  return Boolean(rideId) || event.startsWith("ride.") || event.startsWith("driver.") || event.includes("corrida");
}

function forwardPushToPartnerShell(data: PushData | undefined): void {
  try { sessionStorage.setItem(PARTNER_PENDING_PUSH_KEY, JSON.stringify(data ?? {})); } catch {}
  window.location.replace("../../index.html");
}`;
if (source.includes(oldPushType)) source = source.replace(oldPushType, newPushType);

const oldResolve = `function resolvePushTarget(data: PushData | undefined): string | null {
  const rawUrl = safeInternalPath(data?.url);
  const event = typeof data?.event === "string" ? data.event.trim().toLowerCase().slice(0, 100) : "";

  // A mesma Edge Function atende Passageiro e Motorista. Eventos de corrida
  // destinados ao APK do Motorista nunca podem abrir uma rota do Passageiro.
  if (APP_ROLE === "motorista" || APP_ROLE === "driver") {
    if (rawUrl === "/motorista" || rawUrl?.startsWith("/motorista/")) return rawUrl;
    if (event.startsWith("driver.") || event.startsWith("ride.")) return "/motorista/app";
    if (rawUrl === "/corridas" || rawUrl?.startsWith("/corrida/")) return "/motorista/app";
    return "/motorista/app";
  }

  if (APP_ROLE === "passageiro" || APP_ROLE === "passenger") {
    if (rawUrl === "/passageiro" || rawUrl?.startsWith("/passageiro/")) return rawUrl;
    if (rawUrl === "/corridas" || rawUrl?.startsWith("/corrida/")) return rawUrl;
    return rawUrl ? "/passageiro/app" : null;
  }

  // O bundle web não deve transformar payload push em redirecionamento para
  // áreas administrativas. Apenas rotas não administrativas são aceitas.
  if (rawUrl?.startsWith("/admin")) return null;
  return rawUrl;
}`;
const newResolve = `function resolvePushTarget(data: PushData | undefined): string | null {
  const rawUrl = safeInternalPath(data?.url);
  const event = typeof data?.event === "string" ? data.event.trim().toLowerCase().slice(0, 100) : "";

  if (APP_ROLE === "motorista" || APP_ROLE === "driver") {
    // No package unificado, payload de Entregas pertence ao outro módulo.
    if (isDeliveryPush(data)) return null;
    if (!isRidePush(data) && !rawUrl?.startsWith("/motorista")) return null;
    return "/motorista/app";
  }

  if (APP_ROLE === "passageiro" || APP_ROLE === "passenger") {
    if (rawUrl === "/passageiro" || rawUrl?.startsWith("/passageiro/")) return rawUrl;
    if (rawUrl === "/corridas" || rawUrl?.startsWith("/corrida/")) return rawUrl;
    return rawUrl ? "/passageiro/app" : null;
  }

  if (rawUrl?.startsWith("/admin")) return null;
  return rawUrl;
}`;
if (source.includes(oldResolve)) source = source.replace(oldResolve, newResolve);

const oldAction = `  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const target = resolvePushTarget(action.notification?.data as PushData | undefined);
    if (!target) return;
    try {
      window.location.assign(target);
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[native] falha ao abrir destino do push", error);
    }
  });`;
const newAction = `  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification?.data as PushData | undefined;
    if (APP_ROLE === "motorista" || APP_ROLE === "driver") {
      if (isDeliveryPush(data)) {
        forwardPushToPartnerShell(data);
        return;
      }
      if (!isRidePush(data)) return;
    }
    const target = resolvePushTarget(data);
    if (!target) return;
    try {
      if (APP_ROLE === "motorista" || APP_ROLE === "driver") {
        window.location.hash = "#/motorista/app";
      } else {
        window.location.assign(target);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[native] falha ao abrir destino do push", error);
    }
  });`;
if (source.includes(oldAction)) source = source.replace(oldAction, newAction);

for (const marker of [
  'PARTNER_PENDING_PUSH_KEY',
  'isDeliveryPush(data)',
  'isRidePush(data)',
  'forwardPushToPartnerShell(data)',
  'window.location.hash = "#/motorista/app"',
]) {
  if (!source.includes(marker)) throw new Error(`Motorista Parceiro: isolamento Push incompleto (${marker}).`);
}
if (source.includes('return "/motorista/app";\n  }\n\n  if (APP_ROLE') && !source.includes('if (isDeliveryPush(data)) return null;')) {
  throw new Error('Motorista Parceiro: payload de Entregas ainda pode cair no Motorista.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: política Pix-only aplicada; Push de corrida usa Hash interno e Push de Entregas vai ao shell.');
