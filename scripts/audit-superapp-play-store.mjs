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
  "appName: 'APOIS'",
  "backgroundColor: '#050505'",
  "overlaysWebView: false",
], 'Capacitor mantém package, label e barras do Superapp');

requireAll('scripts/harden-superapp-android-security.mjs', [
  "['compileSdkVersion', 36]",
  "['targetSdkVersion', 36]",
  "process.env.APP_VERSION_CODE?.trim() || '1'",
  "process.env.APP_VERSION_NAME?.trim() || '1.0.0'",
  "setApplicationAttribute('allowBackup', 'false')",
  "setApplicationAttribute('usesCleartextTraffic', 'false')",
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android:windowSoftInputMode="adjustResize"',
  'android.permission.REQUEST_INSTALL_PACKAGES',
  'android.permission.WRITE_EXTERNAL_STORAGE',
], 'Android release fixa API 36, versionamento e hardening de dados/permissões');

requireAll('scripts/install-superapp-launcher.mjs', [
  "import './harden-superapp-android-security.mjs';",
  'ic_launcher_foreground.png',
  'ic_launcher_round.png',
  'android:allowBackup="false"',
  'android:usesCleartextTraffic="false"',
], 'launcher/adaptive icon executa após hardening Android');

requireAll('codemagic.yaml', [
  'android-superapp-experimental:',
  'name: APOIS Superapp - Android Release',
  'APP_PACKAGE: "br.com.apois.app"',
  'APP_VERSION_CODE: "1"',
  'APP_VERSION_NAME: "1.0.0"',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED: "0"',
  '${CORRIDAS_PUBLIC_APP_URL:?Add a public HTTPS CORRIDAS_PUBLIC_APP_URL to Codemagic}',
  'targetSdkVersion[[:space:]]*=[[:space:]]*36',
  'assembleRelease bundleRelease',
  'jarsigner',
  'APOIS-Superapp.apk',
  'APOIS-Superapp.aab',
], 'Codemagic prepara APK e AAB release, bloqueando configuração nativa incompleta');

forbidAll('codemagic.yaml', [
  '.github/workflows',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED: "1"',
], 'release não habilita Actions nem Push Corridas sem prova Firebase');

requireAll('scripts/validate-superapp-native-config.mjs', [
  "APP_PACKAGE !== 'br.com.apois.app'",
  'CORRIDAS_PUBLIC_APP_URL deve usar HTTPS em modo estrito',
  'CORRIDAS_PUBLIC_APP_URL não pode apontar para localhost/rede local em produção',
  'APP_VERSION_CODE deve ser inteiro positivo',
  'APP_VERSION_NAME deve usar formato semântico',
  'Maps Android e Maps JavaScript não devem compartilhar a mesma chave no release',
  'google-services.json não contém o package',
], 'validador de release rejeita URL, versão, Maps e Firebase incompatíveis');

requireAll('.env.example', [
  'CORRIDAS_PUBLIC_APP_URL=',
  'CORRIDAS_ANDROID_MAPS_API_KEY=',
  'CORRIDAS_WEB_MAPS_API_KEY=',
  'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64=',
  'APOIS_SUPERAPP_RIDES_PUSH_ENABLED=0',
  'APP_VERSION_CODE=1',
  'APP_VERSION_NAME=1.0.0',
], 'ambiente de produção documenta todos os gates externos relevantes');

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
