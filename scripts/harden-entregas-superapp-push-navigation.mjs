import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/lib/customer-push.ts');
let source = readFileSync(path, 'utf8');

const oldFallback = '  return orderId ? `/pedido/${encodeURIComponent(orderId)}` : "/notificacoes";';
const newFallback = '  return orderId ? `#/pedido/${encodeURIComponent(orderId)}` : "#/perfil/notificacoes";';
if (!source.includes(newFallback)) {
  if (!source.includes(oldFallback)) {
    throw new Error('Entregas Push: fallback pós-adaptação esperado não encontrado.');
  }
  source = source.replace(oldFallback, newFallback);
}

const oldAction = `        const target = notificationTarget(action.notification);\n        if (!target) return;\n        const targetHash = \`#\${target}\`;\n        if (window.location.hash !== targetHash) window.location.replace(targetHash);`;
const newAction = `        const target = notificationTarget(action.notification);\n        if (!target) return;\n        if (window.location.hash !== target) window.location.replace(target);`;
if (!source.includes(newAction)) {
  if (!source.includes(oldAction)) throw new Error('Entregas Push: navegação Hash pós-adaptação não encontrada.');
  source = source.replace(oldAction, newAction);
}

for (const marker of [
  'const isDeliveryPush =',
  'if (!target) return;',
  '`#/pedido/${encodeURIComponent(orderId)}`',
  '"#/perfil/notificacoes"',
  'window.location.hash !== target',
]) {
  if (!source.includes(marker)) throw new Error(`Entregas Push: hardening ausente: ${marker}`);
}
for (const forbidden of [
  ': "/notificacoes";',
  'window.location.pathname !== target',
  'const targetHash = `#${target}`;',
]) {
  if (source.includes(forbidden)) throw new Error(`Entregas Push: navegação antiga ainda presente: ${forbidden}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: toque em Push usa apenas rotas Hash válidas do módulo.');
