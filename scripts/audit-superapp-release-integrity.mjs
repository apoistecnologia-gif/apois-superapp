import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const root = resolve('.');

function read(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) {
    console.error(`[FAIL] release integrity: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}

function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}

function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}

const workflowsDir = resolve(root, '.github/workflows');
if (existsSync(workflowsDir) && readdirSync(workflowsDir).some((name) => /\.ya?ml$/i.test(name))) {
  console.error('[FAIL] release integrity: GitHub Actions voltou a existir; o build oficial é Codemagic');
  failed = true;
} else {
  console.log('[OK] release integrity: nenhum GitHub Action ativo');
}

const packageJson = JSON.parse(read('package.json'));
const releaseIntegrity = String(packageJson.scripts?.['audit:release-integrity'] ?? '');
const superappBuild = String(packageJson.scripts?.['build:superapp'] ?? '');
const verifyDist = String(packageJson.scripts?.['verify:dist'] ?? '');
const buildShell = String(packageJson.scripts?.['build:shell'] ?? '');

const releaseGateMarkers = [
  'node scripts/audit-superapp-release-integrity.mjs',
  'npm run verify:retired-provider-source',
  'npm run verify:corridas-driver-eligibility',
  'npm run verify:entregas-direct-order',
  'npm run verify:legacy-provider-runtime',
];
const superappGateMarkers = [
  'npm run audit:play-store',
  'npm run audit:release-integrity',
  'npm run verify:rides-push-firebase',
  'npm run guard:build-sources:capture',
  'npm run build:shell',
  'npm run harden:auth-deeplinks',
  'npm run inject:push-routing',
  'npm run verify:dist',
  'npm run test:build-idempotency',
  'npm run guard:build-sources:verify',
];
if (releaseGateMarkers.some((marker) => !releaseIntegrity.includes(marker)) ||
    superappGateMarkers.some((marker) => !superappBuild.includes(marker))) {
  console.error('[FAIL] pipeline não executa todos os gates de integridade do build');
  failed = true;
} else {
  console.log('[OK] pipeline registra gates de release, fonte, transformações e artefato final');
}

const orderedMarkers = [
  'npm run guard:build-sources:capture',
  'npm run build:shell',
  'npm run harden:auth-deeplinks',
  'npm run inject:push-routing',
  'npm run verify:dist',
  'npm run test:build-idempotency',
  'npm run verify:dist',
  'npm run guard:build-sources:verify',
];
let previous = -1;
for (const marker of orderedMarkers) {
  const position = superappBuild.indexOf(marker, previous + 1);
  if (position < 0 || position <= previous) {
    console.error(`[FAIL] ordem do pipeline incorreta/ausente em build:superapp: ${marker}`);
    failed = true;
    break;
  }
  previous = position;
}
if (!failed) console.log('[OK] artefato é verificado depois das transformações e novamente após o teste de idempotência, com gate final de source');

if (buildShell !== 'node superapp/shell/build.mjs') {
  console.error('[FAIL] build:shell ainda executa mutação externa antes do staging');
  failed = true;
} else {
  console.log('[OK] build:shell delega staging/hardening ao builder sem mutar source previamente');
}

if (!verifyDist.includes('npm run verify:final-artifact')) {
  console.error('[FAIL] verify:dist não verifica o artefato depois das transformações finais');
  failed = true;
} else {
  console.log('[OK] verify:dist inclui verificação explícita do artefato final');
}

requireAll('superapp/shell/build.mjs', [
  'APOIS_SHELL_HTML_PATH: distIndex',
  'scripts/harden-superapp-shell-auth.mjs',
  'scripts/harden-superapp-shell-mobile-ui.mjs',
  'scripts/harden-superapp-shell-auth-deeplink-source.mjs',
  "cpSync(resolve(root, 'index.html'), distIndex)",
], 'shell copia source para staging e aplica hardening somente em dist');

requireAll('scripts/verify-superapp-final-artifact.mjs', [
  'data-apois-superapp-push-routing',
  'Date.now()-Number(previous?.at||0)<5000',
  "'ride_requested'",
  'const OAUTH_HANDOFF_TTL_MS=120000;',
], 'verificador final cobre auth/deep-link e roteamento Push');

requireAll('scripts/guard-superapp-build-sources.mjs', [
  'git status',
  'fallbackSnapshot()',
  'sources',
  'superapp/shell',
  'build alterou source versionado/entrada protegida',
], 'gate de source funciona com Git e com export sem .git');

requireAll('scripts/test-superapp-build-idempotency.mjs', [
  'const first = buildFinalArtifact();',
  'const second = buildFinalArtifact();',
  'if (first !== second)',
], 'teste de idempotência executa o build final duas vezes e compara hashes');

requireAll('.apois/modules.json', [
  'harden-entregas-superapp-account-security.mjs',
  'harden-entregas-superapp-account-deletion.mjs',
  'harden-entregas-superapp-address-ux.mjs',
  'harden-entregas-superapp-customer-ux.mjs',
  '"entregas": {',
  '"install": ["bun", "install"]',
], 'Entregas executa hardeners críticos e reconcilia dependências somente na cópia .work');

requireAll('codemagic.yaml', [
  'name: APOIS Superapp - Android Release',
  'APP_PACKAGE: "br.com.apois.app"',
  'APP_VERSION_CODE: "1"',
  'APP_VERSION_NAME: "1.0.0"',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED: "0"',
  'assembleRelease bundleRelease',
  'zipalign" -v -c -P 16 4 "$SIGNED_APK"',
  'APOIS-Superapp.apk',
  'APOIS-Superapp.aab',
], 'Codemagic entrega APK/AAB, versão explícita e verificação de 16 KB');

forbidAll('codemagic.yaml', [
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED: "1"',
  'assembleDebug',
], 'release não habilita Push Corridas não homologado nem build debug');

requireAll('scripts/harden-superapp-android-security.mjs', [
  "['compileSdkVersion', 36]",
  "['targetSdkVersion', 36]",
  "setApplicationAttribute('allowBackup', 'false')",
  "setApplicationAttribute('usesCleartextTraffic', 'false')",
  'android.permission.ACCESS_BACKGROUND_LOCATION',
], 'Android mantém API 36 e hardening de dados/permissões');

requireAll('scripts/harden-entregas-superapp-account-deletion.mjs', [
  'request_own_account_deletion',
  'Excluir minha conta',
  'Solicitar exclusão da conta',
], 'fluxo interno de exclusão permanece integrado ao cliente');

requireAll('supabase/functions/account-deletion/index.ts', [
  'Solicitar exclusão da conta',
  'external_account_deletion_requests',
  'Se houver uma conta associada ao e-mail informado',
], 'recurso público de exclusão permanece versionado');

requireAll('supabase/functions/privacy-policy/index.ts', [
  'Política de Privacidade | APOIS',
  'Retenção e exclusão',
  'LGPD',
], 'política pública de privacidade permanece versionada');

requireAll('supabase/functions/google-maps-address/index.ts', [
  'consume_google_maps_lookup_quota',
  'action === "reverse_geocode"',
  'action === "autocomplete"',
  'action === "place_details"',
], 'Maps de Entregas mantém quota e três operações necessárias');

requireAll('.env.example', [
  'CORRIDAS_PUBLIC_APP_URL=',
  'CORRIDAS_ANDROID_MAPS_API_KEY=',
  'CORRIDAS_WEB_MAPS_API_KEY=',
  'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64=',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED=0',
  'APP_VERSION_CODE=1',
  'APP_VERSION_NAME=1.0.0',
], 'gates externos do release permanecem documentados');

process.exit(failed ? 1 : 0);
