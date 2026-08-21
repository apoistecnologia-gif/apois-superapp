import './harden-partner-motorista-active-resume.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(root, workspace, 'src/lib/nativeBridge.ts');
let source = readFileSync(path, 'utf8');

const actionBefore = `  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
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

const actionAfter = `  await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    const data = action.notification?.data as PushData | undefined;
    if (APP_ROLE === "motorista" || APP_ROLE === "driver") {
      const delivery = isDeliveryPush(data);
      const ride = isRidePush(data);
      // Payload ambíguo nunca pode escolher um produto por ordem de if.
      if (delivery && ride) return;
      if (delivery) {
        forwardPushToPartnerShell(data);
        return;
      }
      if (!ride) return;
    }
    const target = resolvePushTarget(data);
    if (!target) return;
    try {
      if (APP_ROLE === "motorista" || APP_ROLE === "driver") {
        window.dispatchEvent(new CustomEvent("apois:driver-push-open", { detail: data ?? {} }));
        window.location.hash = "#/motorista/app";
      } else {
        window.location.assign(target);
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[native] falha ao abrir destino do push", error);
    }
  });`;

if (source.includes(actionBefore)) source = source.replace(actionBefore, actionAfter);

const registrationError = `  await PushNotifications.addListener("registrationError", (error) => {
    if (import.meta.env.DEV) console.warn("[native] registrationError", error);
  });`;
const foregroundListener = `${registrationError}
  await PushNotifications.addListener("pushNotificationReceived", (notification) => {
    const data = notification?.data as PushData | undefined;
    if (APP_ROLE !== "motorista" && APP_ROLE !== "driver") return;
    const delivery = isDeliveryPush(data);
    const ride = isRidePush(data);
    // Não alterna módulo automaticamente em foreground e ignora payload ambíguo.
    if (delivery && ride) return;
    if (delivery) {
      try { sessionStorage.setItem(PARTNER_PENDING_PUSH_KEY, JSON.stringify(data ?? {})); } catch {}
      return;
    }
    if (!ride) return;
    window.dispatchEvent(new CustomEvent("apois:driver-push", { detail: data ?? {} }));
  });`;

if (!source.includes('pushNotificationReceived')) {
  if (!source.includes(registrationError)) throw new Error('Motorista Parceiro: listener registrationError não encontrado.');
  source = source.replace(registrationError, foregroundListener);
}

for (const marker of [
  'pushNotificationReceived',
  'const delivery = isDeliveryPush(data);',
  'const ride = isRidePush(data);',
  'if (delivery && ride) return;',
  'new CustomEvent("apois:driver-push"',
  'new CustomEvent("apois:driver-push-open"',
]) {
  if (!source.includes(marker)) throw new Error(`Motorista Parceiro: runtime Push incompleto (${marker}).`);
}

if (source.includes('PushNotifications.unregister()')) {
  throw new Error('Motorista Parceiro: não pode desregistrar o token FCM compartilhado.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista Parceiro: Push em foreground atualiza Corridas sem trocar produto; payload ambíguo é ignorado.');
