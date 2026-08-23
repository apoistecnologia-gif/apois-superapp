import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const target = resolve(root, workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(target, 'utf8');

// A finalização é autoridade exclusiva do backend. O cliente envia somente o
// rideId; preço final, liquidação e próxima corrida são definidos pelas RPCs /
// Edge Functions canônicas. O hardening é estrutural para não depender de
// indentação, quebra de linha ou type assertion introduzida por outros passos.
const callPattern = /await\s+callComplete\s*\(\s*\{\s*data\s*:\s*\{([\s\S]*?)\}\s*\}\s*\)(?:\s+as\s+[A-Za-z_$][\w$.[\]<>| ]*)?\s*;?/g;

let found = 0;
source = source.replace(callPattern, (full, body) => {
  found += 1;
  let hardenedBody = String(body);

  // Remove qualquer tentativa do cliente de determinar preço final. A linha é
  // removida dentro do payload do callComplete, sem tocar em outros usos de
  // estimated_price que ainda são legítimos para exibição da corrida.
  hardenedBody = hardenedBody
    .replace(/\n?\s*final_price\s*:\s*[^,\n}]+,?/g, '')
    .replace(/\n?\s*estimated_price\s*:\s*[^,\n}]+,?/g, '');

  if (!/\brideId\s*:\s*active\.id\b/.test(hardenedBody)) {
    throw new Error('[FAIL] motorista: finalização sem rideId canônico');
  }

  const typeAssertion = full.match(/\)\s+(as\s+[A-Za-z_$][\w$.[\]<>| ]*)\s*;?$/)?.[1] ?? '';
  const suffix = typeAssertion ? ` ${typeAssertion}` : '';
  return `await callComplete({ data: {${hardenedBody}} })${suffix};`;
});

if (found === 0) {
  throw new Error('[FAIL] motorista: chamada de finalização não encontrada');
}

// Auditoria final independente da formatação: todas as chamadas encontradas
// precisam carregar somente o identificador canônico e jamais preço do cliente.
const auditedCalls = [...source.matchAll(/await\s+callComplete\s*\(\s*\{\s*data\s*:\s*\{([\s\S]*?)\}\s*\}\s*\)(?:\s+as\s+[A-Za-z_$][\w$.[\]<>| ]*)?\s*;?/g)];
if (auditedCalls.length === 0) {
  throw new Error('[FAIL] motorista: não foi possível auditar payload de finalização');
}
for (const match of auditedCalls) {
  const body = match[1] ?? '';
  if (/\bfinal_price\b|\bestimated_price\b/.test(body)) {
    throw new Error('[FAIL] motorista: payload de finalização ainda envia preço pelo cliente');
  }
  if (!/\brideId\s*:\s*active\.id\b/.test(body)) {
    throw new Error('[FAIL] motorista: finalização sem rideId canônico');
  }
}

writeFileSync(target, source, 'utf8');
console.log('[OK] Motorista Parceiro: finalização envia somente rideId; preço e liquidação ficam no backend');
