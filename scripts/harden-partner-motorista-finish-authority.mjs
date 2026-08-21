import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const target = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(target, 'utf8');

// A finalização é autoridade exclusiva do backend. O cliente envia somente o
// rideId; preço final, liquidação e próxima corrida são definidos pelas RPCs /
// Edge Functions canônicas. Isso evita que um payload legado volte a sugerir
// que o aplicativo pode escolher o valor da corrida.
source = source.replaceAll(
  `await callComplete({ data: {\n              rideId: active.id,\n              final_price: active.estimated_price ? Number(active.estimated_price) : undefined,\n            } });`,
  `await callComplete({ data: {\n              rideId: active.id,\n            } });`,
);

source = source.replaceAll(
  `await callComplete({ data: {\n                rideId: active.id,\n                final_price: active.estimated_price ? Number(active.estimated_price) : undefined,\n              } });`,
  `await callComplete({ data: {\n                rideId: active.id,\n              } });`,
);

if (!source.includes('await callComplete({ data: {')) {
  throw new Error('[FAIL] motorista: chamada de finalização não encontrada');
}

const completeCalls = source.match(/await callComplete\(\{ data: \{[\s\S]{0,220?}?\}\s*\}\);/g) ?? [];
if (completeCalls.length === 0) {
  throw new Error('[FAIL] motorista: não foi possível auditar payload de finalização');
}
for (const call of completeCalls) {
  if (call.includes('final_price') || call.includes('estimated_price')) {
    throw new Error('[FAIL] motorista: payload de finalização ainda envia preço pelo cliente');
  }
  if (!call.includes('rideId: active.id')) {
    throw new Error('[FAIL] motorista: finalização sem rideId canônico');
  }
}

writeFileSync(target, source, 'utf8');
console.log('[OK] Motorista Parceiro: finalização envia somente rideId; preço e liquidação ficam no backend');
