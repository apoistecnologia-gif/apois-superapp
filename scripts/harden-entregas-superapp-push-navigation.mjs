import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/lib/customer-push.ts');
let source = readFileSync(path, 'utf8');

// O snapshot protegido mudou de forma ao longo do tempo: ternário de uma linha,
// ou bloco de três linhas com checagem de tipo. Os dois formatos são aceitos —
// exigir apenas um deles derrubava o build de Entregas inteiro.
const fallbackVariants = [
  [
    '  return orderId ? `/pedido/${encodeURIComponent(orderId)}` : "/notificacoes";',
    '  return orderId ? `#/pedido/${encodeURIComponent(orderId)}` : "#/notificacoes";',
  ],
  [
    '  return typeof orderId === "string" && orderId.trim()\n    ? `/pedido/${encodeURIComponent(orderId)}`\n    : "/notificacoes";',
    '  return typeof orderId === "string" && orderId.trim()\n    ? `#/pedido/${encodeURIComponent(orderId)}`\n    : "#/notificacoes";',
  ],
];
if (!source.includes('#/notificacoes')) {
  const variant = fallbackVariants.find(([search]) => source.includes(search));
  if (!variant) throw new Error('Entregas Push: fallback pós-adaptação esperado não encontrado.');
  source = source.replace(variant[0], variant[1]);
}

const newAction = `        const target = notificationTarget(action.notification);\n        if (!target) return;\n        if (window.location.hash !== target) window.location.replace(target);`;
// Formatos anteriores: com hashPrefix explícito, ou navegando por pathname (que o
// Hash Router do Superapp ignora, então o toque na notificação não abria o pedido).
const actionVariants = [
  `        const target = notificationTarget(action.notification);\n        if (!target) return;\n        const targetHash = \`#\${target}\`;\n        if (window.location.hash !== targetHash) window.location.replace(targetHash);`,
  `        const target = notificationTarget(action.notification);\n        if (!target) return;\n        if (window.location.pathname !== target) window.location.assign(target);`,
  `        const target = notificationTarget(action.notification);\n        if (window.location.pathname !== target) window.location.assign(target);`,
];
if (!source.includes(newAction)) {
  const variant = actionVariants.find((candidate) => source.includes(candidate));
  if (!variant) throw new Error('Entregas Push: navegação Hash pós-adaptação não encontrada.');
  source = source.replace(variant, newAction);
}

for (const marker of [
  'if (!target) return;',
  '`#/pedido/${encodeURIComponent(orderId)}`',
  '"#/notificacoes"',
  'window.location.hash !== target',
]) {
  if (!source.includes(marker)) throw new Error(`Entregas Push: hardening ausente: ${marker}`);
}
for (const forbidden of [
  '"#/perfil/notificacoes"',
  'window.location.pathname !== target',
  'const targetHash = `#${target}`;',
]) {
  if (source.includes(forbidden)) throw new Error(`Entregas Push: navegação antiga ainda presente: ${forbidden}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: toque em Push abre pedido ou central de notificações pelo Hash Router.');
