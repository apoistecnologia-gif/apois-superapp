import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/lib/customer-push.ts');
let source = readFileSync(path, 'utf8');

const oldFallback = '  return orderId ? `/pedido/${encodeURIComponent(orderId)}` : "/notificacoes";';
const newFallback = '  return orderId ? `/pedido/${encodeURIComponent(orderId)}` : "/perfil/notificacoes";';
if (!source.includes(newFallback)) {
  if (!source.includes(oldFallback)) {
    throw new Error('Entregas Push: fallback pós-adaptação esperado não encontrado.');
  }
  source = source.replace(oldFallback, newFallback);
}

for (const marker of [
  'const isDeliveryPush =',
  'if (!target) return;',
  'const targetHash = `#${target}`;',
  'window.location.hash !== targetHash',
  '"/perfil/notificacoes"',
]) {
  if (!source.includes(marker)) throw new Error(`Entregas Push: hardening ausente: ${marker}`);
}
for (const forbidden of [
  ': "/notificacoes";',
  'window.location.pathname !== target',
]) {
  if (source.includes(forbidden)) throw new Error(`Entregas Push: navegação antiga ainda presente: ${forbidden}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: toque em Push usa Hash Router e central de notificações válida.');
