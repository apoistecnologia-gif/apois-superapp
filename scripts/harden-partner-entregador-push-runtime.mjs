import './harden-partner-entregador-push.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/lib/courier-push.ts');
let source = readFileSync(path, 'utf8');

const oldForeground = `    receivedHandle = await PushNotifications.addListener(\n      "pushNotificationReceived",\n      (notification) => {\n        emitCourierPush(notification);\n      },\n    );`;
const newForeground = `    receivedHandle = await PushNotifications.addListener(\n      "pushNotificationReceived",\n      (notification) => {\n        const data = (notification?.data ?? null) as Record<string, unknown> | null;\n        const delivery = isDeliveryPushPayload(data);\n        const ride = isRidePushPayload(data);\n        // Payload ambíguo nunca escolhe produto por ordem de if.\n        if (delivery && ride) return;\n        // Em foreground não trocamos de módulo automaticamente. Guardamos a\n        // corrida para o shell consumir se o usuário voltar ao seletor.\n        if (ride) {\n          try { sessionStorage.setItem(PARTNER_PENDING_PUSH_KEY, JSON.stringify(data ?? {})); } catch {}\n          return;\n        }\n        if (!delivery) return;\n        emitCourierPush(notification);\n      },\n    );`;
if (source.includes(oldForeground)) source = source.replace(oldForeground, newForeground);

const oldAction = `      (action) => {\n        const data = (action.notification?.data ?? null) as Record<string, unknown> | null;\n        if (isRidePushPayload(data)) {\n          forwardPartnerPush(data);\n          return;\n        }\n        if (!isDeliveryPushPayload(data)) return;\n        emitCourierPush(action.notification);\n        window.dispatchEvent(new CustomEvent("apois:courier-push-open", { detail: data }));\n      },`;
const newAction = `      (action) => {\n        const data = (action.notification?.data ?? null) as Record<string, unknown> | null;\n        const delivery = isDeliveryPushPayload(data);\n        const ride = isRidePushPayload(data);\n        if (delivery && ride) return;\n        if (ride) {\n          forwardPartnerPush(data);\n          return;\n        }\n        if (!delivery) return;\n        emitCourierPush(action.notification);\n        window.dispatchEvent(new CustomEvent("apois:courier-push-open", { detail: data }));\n      },`;
if (source.includes(oldAction)) source = source.replace(oldAction, newAction);

for (const marker of [
  '"pushNotificationReceived"',
  'const delivery = isDeliveryPushPayload(data);',
  'const ride = isRidePushPayload(data);',
  'if (delivery && ride) return;',
  'sessionStorage.setItem(PARTNER_PENDING_PUSH_KEY',
  'new CustomEvent("apois:courier-push-open"',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: runtime Push incompleto (${marker}).`);
}
if (source.includes('PushNotifications.unregister()')) {
  throw new Error('Entregador Parceiro: runtime não pode invalidar o token FCM compartilhado.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: Push foreground/tap isolado por produto, payload ambíguo ignorado e token compartilhado preservado.');
