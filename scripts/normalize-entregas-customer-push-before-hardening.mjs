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

const functionPattern = /function notificationTarget\(notification\?: PushNotificationSchema\)(?:: string \| null)? \{[\s\S]*?\n\}/;

if (!functionPattern.test(source)) {
  throw new Error('Entregas customer-push: função notificationTarget não encontrada.');
}

source = source.replace(functionPattern, originalFunction);
writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: notificationTarget normalizado antes do hardener do Superapp.');
