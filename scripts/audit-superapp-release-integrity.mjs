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
];
if (releaseGateMarkers.some((marker) => !releaseIntegrity.includes(marker)) ||
    superappGateMarkers.some((marker) => !superappBuild.includes(marker))) {
  console.error('[FAIL] pipeline não executa todos os gates de integridade antes dos builds');
  failed = true;
} else {
  console.log('[OK] pipeline executa gates Play Store, providers aposentados e integridade antes dos builds');
}

{
  const manifestPath = resolve(root, '.apois/modules.json');
  if (!existsSync(manifestPath)) {
    console.error('[FAIL] Entregas executa hardeners críticos e reconcilia dependências somente na cópia .work: arquivo ausente .apois/modules.json');
    failed = true;
  } else {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const entregas = manifest?.modules?.entregas;
    const buildCommand = Array.isArray(entregas?.build) ? entregas.build.join(' ') : '';
    const requiredMarkers = [
      'harden-entregas-superapp-account-security.mjs',
      'harden-entregas-superapp-account-deletion.mjs',
      'harden-entregas-superapp-address-ux.mjs',
      'harden-entregas-superapp-customer-ux.mjs',
    ];
    const installOk = Array.isArray(entregas?.install) &&
      entregas.install.length === 2 &&
      entregas.install[0] === 'bun' &&
      entregas.install[1] === 'install';
    const missing = requiredMarkers.filter((marker) => !buildCommand.includes(marker));
    if (!installOk || missing.length) {
      const details = [
        ...(!installOk ? ['install Entregas deve ser [bun, install]'] : []),
        ...missing,
      ];
      console.error('[FAIL] Entregas executa hardeners críticos e reconcilia dependências somente na cópia .work: ' + details.join(' | '));
      failed = true;
    } else {
      console.log('[OK] Entregas executa hardeners críticos e reconcilia dependências somente na cópia .work');
    }
  }
}

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
