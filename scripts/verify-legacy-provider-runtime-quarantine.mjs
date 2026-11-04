import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const state = JSON.parse(readFileSync(resolve('docs/legacy-provider-runtime-state.json'), 'utf8'));
const endpoints = Array.isArray(state.endpoints) ? state.endpoints : [];
let failed = false;

const allowed = new Set([
  'SAFE_DISABLED',
  'SAFE_DISABLED_BY_RUNTIME_SETTING',
  'PUBLIC_RESOURCE',
  'PUBLIC_WEBHOOK_ONLY',
  'AUTHENTICATED_BUT_LEGACY',
  'DANGEROUSLY_CALLABLE',
  'REQUIRE_REVIEW',
]);

for (const endpoint of endpoints) {
  if (!endpoint?.project || !endpoint?.function || !allowed.has(endpoint?.classification)) {
    console.error('[FAIL] legacy provider quarantine contém registro inválido', endpoint);
    failed = true;
  }
}

const duplicates = endpoints
  .map((endpoint) => `${endpoint.project}:${endpoint.function}`)
  .filter((key, index, all) => all.indexOf(key) !== index);
if (duplicates.length) {
  console.error(`[FAIL] endpoints duplicados no inventário: ${[...new Set(duplicates)].join(', ')}`);
  failed = true;
}

const blockers = endpoints.filter((endpoint) => endpoint.releaseBlocking === true);
const dangerous = endpoints.filter((endpoint) => endpoint.classification === 'DANGEROUSLY_CALLABLE');
const unknown = endpoints.filter((endpoint) => endpoint.classification === 'REQUIRE_REVIEW');

console.log(`[INFO] legacy provider endpoints inventariados: ${endpoints.length}`);
console.log(`[INFO] DANGEROUSLY_CALLABLE: ${dangerous.length}`);
console.log(`[INFO] REQUIRE_REVIEW: ${unknown.length}`);
console.log(`[INFO] releaseBlocking: ${blockers.length}`);

if (blockers.length) {
  for (const endpoint of blockers) {
    console.error(`[BLOCK] ${endpoint.project}/${endpoint.function}: ${endpoint.classification} — ${endpoint.evidence}`);
  }
  console.error('[FAIL] Release bloqueado: runtimes legados de gateway ainda estão expostos ou não foram provados fail-closed.');
  process.exit(1);
}

if (failed) process.exit(1);
console.log('[OK] Nenhum provider legado bloqueia o runtime de release.');
