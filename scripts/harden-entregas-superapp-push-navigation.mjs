import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/lib/customer-push.ts');
let source = readFileSync(path, 'utf8');

const oldTarget = `function notificationTarget(notification?: PushNotificationSchema) {\n  const orderId = notification?.data?.["orderId"];\n  return typeof orderId === "string" && orderId.trim()\n    ? \`/pedido/\${encodeURIComponent(orderId)}\`\n    : "/notificacoes";\n}`;
const newTarget = `function notificationTarget(notification?: PushNotificationSchema) {\n  const orderId = notification?.data?.["orderId"];\n  return typeof orderId === "string" && orderId.trim()\n    ? \`#/pedido/\${encodeURIComponent(orderId)}\`\n    : "#/perfil/notificacoes";\n}`;

if (!source.includes(newTarget)) {
  if (!source.includes(oldTarget)) throw new Error('Entregas Push: notificationTarget esperado não encontrado.');
  source = source.replace(oldTarget, newTarget);
}

const oldAction = `        const target = notificationTarget(action.notification);\n        if (window.location.pathname !== target) window.location.assign(target);`;
const newAction = `        const target = notificationTarget(action.notification);\n        if (window.location.hash !== target) window.location.assign(target);`;
if (!source.includes(newAction)) {
  if (!source.includes(oldAction)) throw new Error('Entregas Push: navegação esperada não encontrada.');
  source = source.replace(oldAction, newAction);
}

for (const marker of [
  '"#/perfil/notificacoes"',
  '`#/pedido/${encodeURIComponent(orderId)}`',
  'window.location.hash !== target',
]) {
  if (!source.includes(marker)) throw new Error(`Entregas Push: hardening ausente: ${marker}`);
}
if (source.includes(': "/notificacoes";')) throw new Error('Entregas Push: rota antiga inexistente ainda presente.');

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: toque em Push permanece no módulo e usa rotas hash válidas.');
