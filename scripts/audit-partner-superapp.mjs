import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Parceiro: arquivo ausente ${path}`);
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
  } else console.log(`[OK] ${label}`);
}
function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('scripts/build-partner-modules.sh', [
  'bun install --frozen-lockfile',
  'APOIS_MOTORISTA_WORKSPACE=".work/partner-motorista"',
  'APOIS_ENTREGAS_WORKSPACE=".work/partner-entregador"',
  'APOIS_ENTREGAS_AUTH_SCHEME="br.com.apois.parceiro"',
  'VITE_APOIS_NATIVE_SCHEME="br.com.apois.parceiro"',
  'harden-partner-mercadopago-callback.mjs',
  'harden-motorista-mercadopago-disconnect.mjs',
  'harden-partner-motorista-push.mjs',
  'harden-partner-motorista-native-gps.mjs',
  'harden-partner-entregador-push.mjs',
  'harden-partner-entregador-map.mjs',
  'register_courier_push_device_v2',
  '_app_package: "br.com.apois.parceiro"',
  'appTarget: "partner"',
  'PushNotifications.unregister()',
  'CORRIDAS_MAPS_KEY_VALUE="${CORRIDAS_WEB_MAPS_API_KEY:-}"',
  'export VITE_GOOGLE_MAPS_API_KEY="$CORRIDAS_MAPS_KEY_VALUE"',
  'export VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY="$CORRIDAS_MAPS_KEY_VALUE"',
  'export VITE_GOOGLE_MAPS_BROWSER_KEY="$CORRIDAS_MAPS_KEY_VALUE"',
  'Conectar Mercado Pago',
  'Siga a rota até o ponto de embarque',
  'Como foi o passageiro?',
], 'build Parceiro preserva lockfiles, OAuth, Push cruzado, GPS, mapas, Mercado Pago e jornada');

requireAll('scripts/configure-partner-android.mjs', [
  "ensurePermission('android.permission.ACCESS_FINE_LOCATION')",
  "ensurePermission('android.permission.ACCESS_COARSE_LOCATION')",
  "ensurePermission('android.permission.POST_NOTIFICATIONS')",
  'android:scheme="br.com.apois.parceiro"',
  'android:scheme="apoismotorista"',
  'legacyPartnerMpFilterPattern',
  'callback Mercado Pago legado do app cliente permaneceu',
  'registerPlugin(DriverVoicePlugin.class)',
  'com.google.android.tts',
], 'Android Parceiro possui localização, notificações, deep links próprios, isolamento OAuth e voz nativa');
forbidAll('scripts/configure-partner-android.mjs', [
  'android.permission.REQUEST_INSTALL_PACKAGES',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'if (!manifest.includes(\'android:scheme="br.com.apois.app"\'))',
], 'Parceiro não solicita permissões desnecessárias nem recria callback Mercado Pago do app cliente');

requireAll('scripts/install-partner-driver-location.mjs', [
  'sources/apois-corridas-motorista-admin/android-motorista',
  'DriverLocationPlugin.java',
  'DriverLocationService.java',
  'registerPlugin(DriverLocationPlugin.class)',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android:name=".DriverLocationService"',
  'android:foregroundServiceType="location"',
  'com.google.android.gms:play-services-location:21.3.0',
  'ic_stat_apois_notification.xml',
  'driver_set_presence',
], 'Host Android Parceiro incorpora o serviço nativo real que mantém presença do Motorista em background');
forbidAll('scripts/install-partner-driver-location.mjs', [
  "ensurePermission('android.permission.ACCESS_BACKGROUND_LOCATION')",
], 'DriverLocation do Parceiro não introduz permissão Android de localização em background desnecessária');

requireAll('superapp/partner-shell/capacitor.config.ts', [
  "appId: 'br.com.apois.parceiro'",
  "style: 'LIGHT'",
  "backgroundColor: '#050505'",
], 'Host Android Parceiro usa package próprio e barra de status legível');
forbidAll('superapp/partner-shell/capacitor.config.ts', [
  "style: 'DARK'",
], 'Parceiro não usa ícones escuros sobre barra de status preta');

requireAll('scripts/harden-partner-android-security.mjs', [
  "['compileSdkVersion', 36]",
  "['targetSdkVersion', 36]",
  "setApplicationAttribute('allowBackup', 'false')",
  "setApplicationAttribute('usesCleartextTraffic', 'false')",
  'PARTNER_VERSION_CODE',
  'PARTNER_VERSION_NAME',
  'const versionCodeRaw = process.env.PARTNER_VERSION_CODE?.trim();',
  'const versionName = process.env.PARTNER_VERSION_NAME?.trim();',
  'PARTNER_VERSION_CODE e PARTNER_VERSION_NAME são obrigatórios no release.',
], 'Parceiro fixa API 36, versão e segurança Android');

requireAll('scripts/harden-partner-mercadopago-callback.mjs', [
  'appTarget: "partner"', 'legacyFilterPattern', 'android:scheme="br.com.apois.parceiro"',
], 'Parceiro usa callback Mercado Pago próprio');

requireAll('scripts/harden-partner-motorista-push.mjs', [
  'PARTNER_PENDING_PUSH_KEY', 'isDeliveryPush(data)', 'isRidePush(data)',
  'forwardPushToPartnerShell(data)', 'window.location.hash = "#/motorista/app"',
], 'Motorista não captura Push de Entregas e não usa rota absoluta quebrada');

requireAll('scripts/harden-partner-motorista-native-gps.mjs', [
  'import { Geolocation } from "@capacitor/geolocation";',
  'import { Capacitor } from "@capacitor/core";',
  'Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] })',
  'Geolocation.getCurrentPosition({',
  'restauração do GPS nativo falhou',
  'Não conseguimos restaurar sua localização. Toque em Ficar online para tentar novamente.',
], 'Motorista usa GPS nativo e não restaura ONLINE fantasma após reabrir o app');

requireAll('scripts/harden-partner-entregador-push.mjs', [
  'register_courier_push_device_v2', '_app_package: "br.com.apois.parceiro"',
  'PARTNER_PENDING_PUSH_KEY', 'isRidePushPayload(data)', 'isDeliveryPushPayload(data)',
  'PushNotifications.unregister()',
], 'Entregador registra package correto, encaminha Push cruzado e remove unregister compartilhado');

requireAll('scripts/harden-partner-entregador-router.mjs', [
  'createHashHistory',
  'history: hashHistory',
], 'Entregador Parceiro usa Hash History no módulo aninhado');
requireAll('scripts/harden-partner-entregador-hash-boundary.mjs', [
  'const hashPath = window.location.hash',
  'endsWith("/index.html") ? "/courier"',
], 'boundary de sessão do Entregador respeita Hash History no módulo aninhado');
requireAll('.work/partner-entregador/src/components/AuthSessionIsolation.tsx', [
  'const hashPath = window.location.hash',
  'endsWith("/index.html") ? "/courier"',
], 'bundle-fonte do Entregador normaliza a rota Hash antes do boundary de sessão');

requireAll('scripts/harden-partner-entregador-journey.mjs', [
  'import { Geolocation } from "@capacitor/geolocation";',
  'Geolocation.checkPermissions()', 'Geolocation.requestPermissions({', 'Geolocation.getCurrentPosition({',
  'coords = nativePosition.coords;', 'coords = webPosition.coords;',
  'const courierReadableError =', 'fresh accurate courier location required',
  'Esta chamada expirou ou já foi aceita por outro entregador.',
], 'Entregador usa GPS nativo para ficar online e traduz falhas operacionais');

requireAll('scripts/harden-partner-entregador-map.mjs', [
  "import './harden-partner-entregador-journey.mjs';",
  'const APOIS_GOLD = "#F6BE1C";', 'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY', '"DEMO_MAP_ID"', 'strokeColor: APOIS_GOLD',
], 'mapa Entregador tem jornada nativa, chave resiliente, fallback de Map ID e rota dourada');

requireAll('scripts/configure-partner-firebase.mjs', [
  'FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64', 'PARTNER_FIREBASE_PROJECT_ID',
  "'movvi-4d041'", 'br.com.apois.parceiro', "apply plugin: 'com.google.gms.google-services'",
], 'Firebase Parceiro exige package próprio e projeto comum do ecossistema');

requireAll('scripts/install-partner-launcher.mjs', [
  "import './harden-partner-mercadopago-callback.mjs';",
  "import './harden-partner-android-security.mjs';",
  "import './configure-partner-firebase.mjs';",
  "import './install-partner-driver-location.mjs';",
  'registerPlugin(DriverLocationPlugin.class)',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'Firebase do APOIS Parceiro não foi materializado.',
], 'launcher valida OAuth, segurança, Firebase e serviço de localização do Motorista');

requireAll('superapp/partner-shell/index.html', [
  'PARTNER_PENDING_PUSH_KEY', 'consumePendingPartnerPush', 'pushNotificationActionPerformed',
  'relayPartnerPush', './modules/entregador/index.html#/courier', './modules/motorista/index.html#/motorista/app',
  'if(isDelivery&&isRide)return false;',
], 'shell consome Push encaminhado, ignora ambíguos e abre o módulo correto');

requireAll('supabase/migrations/20260821164500_partner_courier_push_package.sql', [
  'register_courier_push_device_v2', "'br.com.apois.entregador','br.com.apois.parceiro'",
  'app_package = excluded.app_package',
], 'registro FCM Entregador por package está versionado');
requireAll('supabase/functions/dispatch-push-outbox/index.ts', [
  'LEGACY_COURIER_PACKAGE', 'PARTNER_PACKAGE',
  'requestedPackage === PARTNER_PACKAGE ? PARTNER_PACKAGE : LEGACY_COURIER_PACKAGE',
  'restricted_package_name: target.packageName',
], 'dispatcher Entregas respeita package legado/Parceiro');

requireAll('codemagic.yaml', [
  'android-partner-superapp:', 'PARTNER_APP_PACKAGE: "br.com.apois.parceiro"',
  'PARTNER_VERSION_CODE: "1"', 'PARTNER_VERSION_NAME: "1.0.0"',
  'grep -Fq "versionCode ${PARTNER_VERSION_CODE}" superapp/partner-shell/android/app/build.gradle',
  'grep -Fq "versionName \\"${PARTNER_VERSION_NAME}\\"" superapp/partner-shell/android/app/build.gradle',
  'FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64', 'register_courier_push_device_v2',
  'test -s superapp/partner-shell/android/app/google-services.json', 'APOIS-Parceiro.apk',
], 'Codemagic bloqueia release Parceiro sem Firebase/package coerentes');

requireAll('.env.example', [
  'FIREBASE_PARTNER_GOOGLE_SERVICES_JSON_BASE64=', 'PARTNER_APP_PACKAGE=br.com.apois.parceiro',
], 'ambiente documenta Firebase/package do Parceiro');

requireAll('scripts/harden-motorista-field-mercadopago.mjs', [
  'mercadopago-driver-status', 'mercadopago-oauth-start', 'Conectar Mercado Pago',
], 'Motorista possui vínculo Mercado Pago direto');
requireAll('scripts/harden-motorista-mercadopago-disconnect.mjs', [
  'disconnect_my_mercadopago_driver', 'Desconectar Mercado Pago',
], 'Motorista pode trocar conta Mercado Pago');

process.exit(failed ? 1 : 0);
