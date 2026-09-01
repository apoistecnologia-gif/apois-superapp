import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Partner Android host v11: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
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

requireAll('scripts/harden-partner-android-security.mjs', [
  "setApplicationAttribute('allowBackup', 'false')",
  "setApplicationAttribute('usesCleartextTraffic', 'false')",
  "['compileSdkVersion', 36]",
  "['targetSdkVersion', 36]",
  'PARTNER_VERSION_CODE',
  'PARTNER_VERSION_NAME',
  'android:windowSoftInputMode="adjustResize"',
], 'Host Android aplica segurança, API 36, versionamento e teclado ajustável');

requireAll('scripts/configure-partner-android.mjs', [
  "ensurePermission('android.permission.ACCESS_FINE_LOCATION')",
  "ensurePermission('android.permission.ACCESS_COARSE_LOCATION')",
  "ensurePermission('android.permission.POST_NOTIFICATIONS')",
  'android:scheme="br.com.apois.parceiro"',
  'android:scheme="apoismotorista"',
  'legacyPartnerMpFilterPattern',
  'registerPlugin(DriverVoicePlugin.class)',
], 'Host Android registra permissões, callbacks próprios e voz nativa');
forbidAll('scripts/configure-partner-android.mjs', [
  'android:scheme="br.com.apois.app" android:host="auth" android:pathPrefix="/mercadopago"',
], 'Host Parceiro não recria callback Mercado Pago legado do app cliente');

requireAll('scripts/install-partner-splash.mjs', [
  '<shape android:shape="rectangle">',
  '<solid android:color="#050505" />',
  '@mipmap/ic_launcher',
  'windowSplashScreenBackground',
  'windowSplashScreenAnimatedIcon',
  "finalSplash.includes('android:drawable=\"#050505\"')",
], 'Splash usa drawable XML válido e identidade APOIS');
forbidAll('scripts/install-partner-splash.mjs', [
  '<item android:drawable="#050505" />',
], 'Splash não usa literal de cor inválido no atributo drawable');

requireAll('scripts/harden-partner-location-notification-routing.mjs', [
  "{ file: 'DriverLocationService.java', module: 'motorista' }",
  "{ file: 'CourierLocationService.java', module: 'entregador' }",
  'openApp.setData(Uri.parse(',
  'br.com.apois.parceiro://module/',
], 'Notificações persistentes retornam diretamente ao módulo operacional');

requireAll('scripts/harden-partner-location-startup-ack.mjs', [
  'driver_running',
  'courier_running',
  'STARTUP_ACK_DELAY_MS = 900L',
  'startup.getBoolean(STARTUP_KEY, false)',
  'setStartupConfirmed(true);',
], 'Host exige confirmação real do Foreground Service antes de considerar GPS de background iniciado');

requireAll('scripts/install-partner-launcher.mjs', [
  "import './harden-partner-android-security.mjs';",
  "import './configure-partner-firebase.mjs';",
  "import './install-partner-driver-location.mjs';",
  "import './install-partner-courier-location.mjs';",
  "import './harden-partner-location-startup-ack.mjs';",
  "import './harden-partner-location-notification-routing.mjs';",
  "await import('./verify-partner-native-plugins.mjs');",
  'br.com.apois.parceiro://module/motorista',
  'br.com.apois.parceiro://module/entregador',
  'driver_running',
  'courier_running',
], 'Launcher encadeia segurança, Firebase, GPS, ACK real, roteamento e verificação nativa na ordem final');

requireAll('superapp/partner-shell/package.json', [
  '"@capacitor/android": "8.5.0"',
  '"@capacitor/core": "8.5.0"',
  '"@capacitor/app": "8.1.1"',
  '"@capacitor/geolocation": "8.2.0"',
  '"@capacitor/push-notifications": "8.1.2"',
], 'Host mantém plugins Capacitor necessários ao runtime nativo');

const codemagic = read('codemagic.yaml');
if (codemagic.includes('android-field-apps-test:') || codemagic.includes('APOIS-Motorista.apk') || codemagic.includes('APOIS-Entregador.apk')) {
  console.error('[FAIL] Partner Android host v11: workflow legado de APKs separados voltou ao Codemagic');
  failed = true;
} else {
  console.log('[OK] Codemagic mantém somente os aplicativos unificados Cliente e Parceiro.');
}
const partnerStart = codemagic.indexOf('  android-partner-superapp:');
const nextWorkflow = partnerStart >= 0 ? codemagic.indexOf('\n  android-', partnerStart + 4) : -1;
const partnerEnd = nextWorkflow > partnerStart ? nextWorkflow : codemagic.length;
const partnerWorkflow = partnerStart >= 0 ? codemagic.slice(partnerStart, partnerEnd) : '';
if (!partnerWorkflow) {
  console.error('[FAIL] Partner Android host v11: workflow android-partner-superapp não encontrado');
  failed = true;
} else {
  if (!partnerWorkflow.includes('npm run verify:pins')) {
    console.error('[FAIL] Partner Android host v11: workflow Parceiro não valida snapshots protegidos');
    failed = true;
  }
  if (!partnerWorkflow.includes('cd superapp/partner-shell\n          # Este host não possui bun.lock próprio.')) {
    console.error('[FAIL] Partner Android host v11: etapa de instalação do host Parceiro não documenta ausência de lockfile');
    failed = true;
  }
  if (!partnerWorkflow.includes('\n          bun install\n          rm -rf android')) {
    console.error('[FAIL] Partner Android host v11: host Parceiro não instala dependências antes do cap add');
    failed = true;
  }
  if (partnerWorkflow.includes('cd superapp/partner-shell\n          bun install --frozen-lockfile')) {
    console.error('[FAIL] Partner Android host v11: --frozen-lockfile reapareceu no host sem bun.lock e bloquearia o Codemagic');
    failed = true;
  } else {
    console.log('[OK] Codemagic Parceiro não exige lockfile inexistente antes de criar o Android.');
  }
}

if (!failed) console.log('[OK] Partner Android host v11: pré-release protege Manifest/API 36, callbacks, plugins, GPS com ACK real, notificações, splash compilável e somente o workflow unificado no Codemagic.');
process.exit(failed ? 1 : 0);
