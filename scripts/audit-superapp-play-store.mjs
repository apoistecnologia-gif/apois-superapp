import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;

function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Play Store: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}

function requireAll(path, markers, label) {
  const source = read(path);
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
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}

requireAll('superapp/shell/capacitor.config.ts', [
  "appId: 'br.com.apois.app'",
  "appName: 'APOIS Cliente'",
  'allowMixedContent: false',
  "backgroundColor: '#050505'",
  "overlaysWebView: false",
], 'Capacitor mantém package, label, mixed-content bloqueado e barras do Superapp Cliente');

requireAll('scripts/harden-superapp-android-security.mjs', [
  "['compileSdkVersion', 36]",
  "['targetSdkVersion', 36]",
  'const versionCodeRaw = process.env.APP_VERSION_CODE?.trim();',
  'const versionName = process.env.APP_VERSION_NAME?.trim();',
  'APP_VERSION_CODE e APP_VERSION_NAME são obrigatórios no release.',
  "setApplicationAttribute('allowBackup', 'false')",
  "setApplicationAttribute('usesCleartextTraffic', 'false')",
  "setApplicationAttribute('fullBackupContent', '@xml/apois_backup_rules')",
  "setApplicationAttribute('dataExtractionRules', '@xml/apois_data_extraction_rules')",
  "const backupRulesPath = resolve(resXmlDir, 'apois_backup_rules.xml');",
  "const dataExtractionRulesPath = resolve(resXmlDir, 'apois_data_extraction_rules.xml');",
  '<full-backup-content>',
  '<data-extraction-rules>',
  '<cloud-backup>',
  '<device-transfer>',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android:windowSoftInputMode="adjustResize"',
  'android.permission.REQUEST_INSTALL_PACKAGES',
  'android.permission.WRITE_EXTERNAL_STORAGE',
], 'Android release fixa API 36, versionamento, backup/D2D, cleartext e hardening de permissões');

requireAll('scripts/install-superapp-launcher.mjs', [
  "import './harden-superapp-android-security.mjs';",
  "superapp/branding/apois-launcher.png",
  "superapp/branding/apois-launcher-foreground.png",
  'function assertPng(path, label)',
  'pngSignature',
  'ic_launcher_foreground.png',
  'ic_launcher_round.png',
  'android:allowBackup="false"',
  'android:usesCleartextTraffic="false"',
], 'launcher/adaptive icon usa fontes PNG válidas após hardening Android');

requireAll('codemagic.yaml', [
  'android-superapp-experimental:',
  'name: APOIS Superapp - Android Release',
  'APP_PACKAGE: "br.com.apois.app"',
  'APP_VERSION_CODE: "1"',
  'APP_VERSION_NAME: "1.0.0"',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED: "0"',
  'assembleRelease bundleRelease',
  'zipalign" -v -c -P 16 4 "$SIGNED_APK"',
  'jarsigner',
  'APOIS-Superapp.apk',
  'APOIS-Superapp.aab',
], 'Codemagic prepara APK/AAB assinados e verifica empacotamento 16 KB');

forbidAll('codemagic.yaml', [
  '.github/workflows',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED: "1"',
  '${CORRIDAS_PUBLIC_APP_URL:?Add a public HTTPS CORRIDAS_PUBLIC_APP_URL to Codemagic}',
], 'release não usa Actions, não ativa Push Corridas sem prova e não bloqueia build por recurso opcional');

requireAll('scripts/validate-superapp-native-config.mjs', [
  "APP_PACKAGE !== 'br.com.apois.app'",
  'CORRIDAS_PUBLIC_APP_URL ausente; somente o compartilhamento público de corrida ficará indisponível neste release',
  'CORRIDAS_PUBLIC_APP_URL deve usar HTTPS quando configurada em modo estrito',
  'CORRIDAS_PUBLIC_APP_URL não pode apontar para localhost/rede local em produção',
  'APP_VERSION_CODE deve ser inteiro positivo',
  'APP_VERSION_NAME deve usar formato semântico',
  'Maps Android e Maps JavaScript não devem compartilhar a mesma chave no release',
  'google-services.json não contém o package',
], 'validador mantém gates críticos e trata compartilhamento público como recurso opcional');

requireAll('.env.example', [
  'CORRIDAS_PUBLIC_APP_URL=',
  'CORRIDAS_ANDROID_MAPS_API_KEY=',
  'CORRIDAS_WEB_MAPS_API_KEY=',
  'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64=',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED=0',
  'APP_VERSION_CODE=1',
  'APP_VERSION_NAME=1.0.0',
], 'ambiente de produção documenta todos os gates externos relevantes');

requireAll('scripts/harden-entregas-superapp-account-deletion.mjs', [
  'request_own_account_deletion',
  'Excluir minha conta',
  'Solicitar exclusão da conta',
], 'cliente possui caminho explícito de solicitação de exclusão');
requireAll('supabase/migrations/20260819143000_account_deletion_requests.sql', [
  'account_deletion_requests',
  'request_own_account_deletion',
  'revoke all on function public.request_own_account_deletion() from public, anon',
], 'backend registra solicitação autenticada de exclusão');
requireAll('supabase/functions/account-deletion/index.ts', [
  'Solicitar exclusão da conta',
  'external_account_deletion_requests',
  'Se houver uma conta associada ao e-mail informado',
  'SERVICE_ROLE',
], 'recurso público de exclusão é versionado sem revelar existência da conta');
requireAll('supabase/migrations/20260819144000_external_account_deletion_requests.sql', [
  'external_account_deletion_requests',
  'revoke all on table public.external_account_deletion_requests from public, anon, authenticated',
  'grant all on table public.external_account_deletion_requests to service_role',
], 'fila pública de exclusão não é legível pelo cliente');
requireAll('supabase/functions/privacy-policy/index.ts', [
  'Política de Privacidade | APOIS',
  'Retenção e exclusão',
  'Perfil → Dados pessoais → Excluir minha conta',
  'LGPD',
], 'política de privacidade pública está versionada em HTML');

requireAll('supabase/functions/google-maps-address/index.ts', [
  'consume_google_maps_lookup_quota',
  'status: 429',
  'action === "reverse_geocode"',
  'action === "autocomplete"',
  'action === "place_details"',
], 'Maps Entregas está versionado com quota e ações preservadas');

requireAll('supabase/migrations/20260819141500_google_maps_lookup_quota.sql', [
  'request_count < 120',
  'revoke all on function public.consume_google_maps_lookup_quota() from anon',
  'grant execute on function public.consume_google_maps_lookup_quota() to authenticated',
], 'quota Maps fica rastreável e negada ao anon');

process.exit(failed ? 1 : 0);
