import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error(`[FAIL] Final integration v22: ${message}`); failed = true; };
const ok = (message) => console.log(`[OK] Final integration v22: ${message}`);

function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    fail(`arquivo ausente: ${path}`);
    return '';
  }
  return readFileSync(full, 'utf8');
}

function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) fail(`${label}: ausente ${missing.join(' | ')}`);
  else ok(label);
}

function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) fail(`${label}: proibido ${found.join(' | ')}`);
  else ok(label);
}

const packageJson = JSON.parse(read('package.json'));
const uiAudit = String(packageJson.scripts?.['audit:ui'] ?? '');
for (const audit of [
  'audit-mobile-ui-v16.mjs',
  'audit-unified-app-surfaces-v17.mjs',
  'audit-codemagic-host-installs-v18.mjs',
  'audit-entregas-order-finish-ui-v19.mjs',
  'audit-entregas-auth-mobile-ui-v20.mjs',
  'audit-shell-branding-v21.mjs',
  'audit-final-integration-v22.mjs',
  'audit-unified-brand-theme-v23.mjs',
]) {
  if (!uiAudit.includes(audit)) fail(`audit:ui não encadeia ${audit}`);
}
if (!failed) ok('audit:ui encadeia toda a revisão visual/integrada v16-v23');

const buildSuperapp = String(packageJson.scripts?.['build:superapp'] ?? '');
const buildPartner = String(packageJson.scripts?.['build:partner'] ?? '');
for (const [name, script] of [['build:superapp', buildSuperapp], ['build:partner', buildPartner]]) {
  if (!script.includes('npm run audit:ui')) fail(`${name} não executa auditoria visual antes do build`);
  if (!script.includes('npm run verify:pins')) fail(`${name} não verifica snapshots protegidos antes do build`);
}
if (buildSuperapp.includes('build:motorista')) fail('build:superapp voltou a incluir Motorista');
if (!buildPartner.includes('build-partner-release.sh')) fail('build:partner não usa o empacotamento release unificado Motorista + Entregador');
if (process.platform === 'win32' && !buildPartner.includes('scripts/run-bash.mjs')) fail('build:partner não usa runner compatível com Windows para o Bash');
if (!failed) ok('builds Cliente e Parceiro mantêm gates e separação de responsabilidades');

const sourceLock = JSON.parse(read('.apois/source-lock.json'));
requireAll('.apois/source-lock.json', [
  sourceLock.sources?.entregas?.commit,
  sourceLock.sources?.corridas_passageiro?.commit,
  sourceLock.sources?.corridas_motorista_admin?.commit,
  'pinned read-only source snapshots',
], 'snapshots protegidos permanecem fixados nos commits oficiais');

const codemagic = read('codemagic.yaml');
const workflowKeys = [...codemagic.matchAll(/^  ([a-z0-9-]+):$/gm)].map((match) => match[1]);
const expectedWorkflows = ['android-superapp-experimental', 'android-partner-superapp'];
if (workflowKeys.length !== expectedWorkflows.length || expectedWorkflows.some((key) => !workflowKeys.includes(key))) {
  fail(`Codemagic deve conter somente dois workflows oficiais; encontrados ${workflowKeys.join(', ') || 'nenhum'}`);
} else ok('Codemagic contém somente Superapp Cliente e APOIS Parceiro');

for (const marker of [
  'APOIS-Superapp.apk',
  'APOIS-Superapp.aab',
  'APOIS-Parceiro.apk',
  'npm run verify:pins',
  'npm run audit:ui',
]) {
  if (!codemagic.includes(marker)) fail(`Codemagic sem gate/artefato obrigatório: ${marker}`);
}
for (const forbidden of ['APOIS-Motorista.apk', 'APOIS-Entregador.apk', 'android-field-apps-test:', 'assembleDebug']) {
  if (codemagic.includes(forbidden)) fail(`Codemagic reintroduziu fluxo legado: ${forbidden}`);
}
if (!failed) ok('Codemagic não reintroduz APKs separados nem build debug');

requireAll('superapp/shell/build.mjs', [
  "import '../../scripts/harden-superapp-shell-mobile-ui.mjs';",
  "['corridas', resolve(root, '../../.work/corridas/dist')]",
  "['entregas', resolve(root, '../../.work/entregas/.output/public')]",
  "../branding/apois-client-red-logo.b64",
], 'shell Cliente aplica identidade/mobile, usa marca exclusiva e inclui somente Passageiro + Cliente Entregas');
forbidAll('superapp/shell/build.mjs', ['partner-motorista', 'partner-entregador', "['motorista'", "['entregador'"], 'shell Cliente não copia módulos de parceiro');

requireAll('scripts/harden-superapp-shell-mobile-ui.mjs', [
  "import './harden-superapp-shell-iconography.mjs';",
  "'--red:#E51B23'",
  "'--red-dark:#C9141B'",
  "'@media(max-height:760px)'",
  "'O seu caminho,'",
  "'do seu jeito.'",
  "'min-height:126px'",
  "'aspect-ratio:1/1'",
], 'seletor Cliente usa a nova identidade vermelho/branco, logo contida e viewport pequena');
requireAll('scripts/harden-superapp-shell-iconography.mjs', [
  "import './harden-superapp-shell-copy.mjs';",
  "'<div class=\"visual\">'",
  "'class=\"vehicle-photo\"'",
  "'alt=\"Carro APOIS\"'",
  "'alt=\"Moto de entregas APOIS\"'",
  '/🚘|🚗|🏍️|🛍|🛵|📦/.test(source)',
], 'copy e veículos reais adesivados APOIS são validados antes do mobile hardening');

requireAll('scripts/harden-entregas-superapp-customer-ux.mjs', [
  "import './harden-entregas-superapp-brand-theme.mjs';",
], 'Entregas aplica a nova identidade do Cliente antes da UX interna');
requireAll('scripts/harden-entregas-superapp-brand-theme.mjs', [
  'APOIS_CUSTOMER_RED_V2',
  '--primary: oklch(0.59 0.24 27)',
  "replaceAll('#35A9C9', '#E51B23')",
  'APOIS_CUSTOMER_LOGIN_LIGHT_V3',
  'data-apois-customer-login-red-v3',
], 'Cliente Entregas converte tema e login para a nova identidade APOIS vermelha/clara');

requireAll('scripts/harden-entregas-superapp-checkout-mobile-ui.mjs', [
  "import './harden-entregas-customer-auth-mobile-ui.mjs';",
  "patch('src/routes/perfil/ajuda.tsx'",
  "patch('src/routes/perfil/ajuda/chamado/$ticketId.tsx'",
], 'Entregas inclui autenticação, checkout e suporte na cadeia móvel final');
requireAll('.apois/modules.json', [
  'harden-entregas-superapp-checkout-mobile-ui.mjs',
  'harden-entregas-order-finish-mobile-ui.mjs',
  'harden-entregas-superapp-secondary-mobile-ui.mjs',
  'harden-superapp-module-mobile-ui.mjs entregas',
  'harden-superapp-module-mobile-ui.mjs corridas',
], 'pipeline dos módulos executa os hardeners móveis antes da compilação');

requireAll('superapp/partner-shell/build.mjs', [
  "['motorista', resolve(root, '../../.work/partner-motorista/dist/client')]",
  "['entregador', resolve(root, '../../.work/partner-entregador/.output/public')]",
  "forbidMarker(driverBundle, 'Chat em breve'",
  "forbidMarker(driverBundle, 'Abrir menu'",
  "forbidMarker(driverBundle, 'Solicitar saque'",
  "forbidMarker(courierBundle, 'Solicitar saque'",
  'apois-parceiro:operational-role',
], 'shell Parceiro inclui somente os dois papéis e bloqueia superfícies legadas');

requireAll('scripts/harden-partner-shell-mobile-ui.mjs', [
  'overflow-x:hidden;overflow-y:auto',
  'object-fit:contain;padding:8px',
  '@media(max-height:700px)',
  '@media(max-width:360px)',
], 'seletor Parceiro está protegido para telas baixas/estreitas');
requireAll('scripts/harden-partner-red-visual.mjs', [
  'APOIS_PARTNER_COURIER_RED_VISUAL_V1',
  'APOIS_PARTNER_RED_VISUAL_V1',
  '#E51B23',
], 'APOIS Parceiro aplica identidade vermelho/branco em Motorista e Entregador');

const workflowsDir = resolve('.github/workflows');
if (existsSync(workflowsDir) && readdirSync(workflowsDir).some((name) => /\.ya?ml$/i.test(name))) {
  fail('GitHub Actions reapareceu; release oficial deve continuar no Codemagic');
} else ok('não há GitHub Actions concorrendo com o caminho oficial de release');

if (!failed) {
  console.log('[OK] Final integration v22: auditoria estática integrada concluída; código está liberado para a etapa externa de compilação/homologação no Codemagic.');
}
process.exit(failed ? 1 : 0);
