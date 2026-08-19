import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/lib/customer-push.ts');
let source = readFileSync(path, 'utf8');

const originalFunction = `function notificationTarget(notification?: PushNotificationSchema) {
  const orderId = notification?.data?.["orderId"];
  return typeof orderId === "string" && orderId.trim()
    ? \`/pedido/\${encodeURIComponent(orderId)}\`
    : "/notificacoes";
}`;

const originalReceived = `    receivedHandle = await PushNotifications.addListener("pushNotificationReceived", () => {
      window.dispatchEvent(new CustomEvent("apois:customer-push"));
    });`;

const originalAction = `    actionHandle = await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action) => {
        const target = notificationTarget(action.notification);
        if (window.location.pathname !== target) window.location.assign(target);
      },
    );`;

const functionPattern = /function notificationTarget\(notification\?: PushNotificationSchema\)(?:: string \| null)? \{[\s\S]*?\n\}/;
const receivedPattern = /    receivedHandle = await PushNotifications\.addListener\("pushNotificationReceived",[\s\S]*?\n    \}\);/;
const actionPattern = /    actionHandle = await PushNotifications\.addListener\(\n      "pushNotificationActionPerformed",[\s\S]*?\n    \);/;

for (const [pattern, replacement, label] of [
  [functionPattern, originalFunction, 'notificationTarget'],
  [receivedPattern, originalReceived, 'pushNotificationReceived'],
  [actionPattern, originalAction, 'pushNotificationActionPerformed'],
]) {
  if (!pattern.test(source)) throw new Error(`Entregas customer-push: ${label} não encontrado.`);
  source = source.replace(pattern, replacement);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: alvos de Push normalizados estruturalmente antes do hardener do Superapp.');
