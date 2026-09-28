import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const targets = [
  ['shell', 'superapp/shell/dist/index.html'],
  ['corridas', 'superapp/shell/dist/modules/corridas/index.html'],
  ['entregas', 'superapp/shell/dist/modules/entregas/index.html'],
];

function fail(message) {
  failed = true;
  console.error(`[FAIL] artefato final: ${message}`);
}
function ok(message) {
  console.log(`[OK] artefato final: ${message}`);
}

for (const [name, relative] of targets) {
  const path = resolve(relative);
  if (!existsSync(path)) {
    fail(`${name}: ausente ${relative}`);
    continue;
  }
  const source = readFileSync(path, 'utf8');
  const temporaryDedup =
    source.includes('Date.now()-Number(previous?.at||0)<5000') ||
    source.includes('Date.now() - Number(previous?.at || 0) < 5000');
  if (!temporaryDedup) fail(`${name}: deduplicação temporária de deep link ausente`);
  if (source.includes('if(previous===rawUrl)return true') || source.includes('if (previous === rawUrl) return true')) {
    fail(`${name}: deduplicação permanente antiga reapareceu`);
  }
  if (!source.includes('data-apois-superapp-push-routing')) {
    fail(`${name}: roteamento global de Push ausente`);
  }
  if (!source.includes("'ride_requested'") || !source.includes('if (!destination) return;')) {
    fail(`${name}: roteamento Push não contém contrato mínimo de Corridas`);
  }
  if (temporaryDedup && source.includes('data-apois-superapp-push-routing')) {
    ok(`${name}: auth/deep-link e Push presentes após todas as transformações`);
  }
}

const shellPath = resolve('superapp/shell/dist/index.html');
if (existsSync(shellPath)) {
  const shell = readFileSync(shellPath, 'utf8');
  for (const marker of [
    'const OAUTH_HANDOFF_TTL_MS=120000;',
    'clearExpiredCorridasGoogle()',
    "if(path==='corridas-reset')",
    "const OAUTH_PENDING_KEY='apois-superapp:pending-oauth-product';",
    'localStorage.getItem(OAUTH_PENDING_KEY)',
    "envelope?.product==='corridas'",
    'age>=0&&age<=OAUTH_HANDOFF_TTL_MS',
    './modules/entregas/index.html',
    './modules/corridas/index.html',
  ]) {
    if (!shell.includes(marker)) fail(`shell: marker final ausente (${marker})`);
  }
}

const corridasPath = resolve('superapp/shell/dist/modules/corridas/index.html');
if (existsSync(corridasPath)) {
  const corridas = readFileSync(corridasPath, 'utf8');
  if (!corridas.includes("const entregasBase = \"../entregas/index.html\";")) {
    fail('corridas: base Push para Entregas ausente/incorreta');
  }
}

const entregasPath = resolve('superapp/shell/dist/modules/entregas/index.html');
if (existsSync(entregasPath)) {
  const entregas = readFileSync(entregasPath, 'utf8');
  if (!entregas.includes("const corridasBase = \"../corridas/index.html\";")) {
    fail('entregas: base Push para Corridas ausente/incorreta');
  }
  if (!entregas.includes('apois-superapp-entregas-back-navigation')) {
    fail('entregas: bridge de navegação Android ausente');
  }
}

if (failed) process.exit(1);
console.log('[OK] artefato final do Superapp foi verificado depois de hardening de auth/deep-link e injeção de Push.');
