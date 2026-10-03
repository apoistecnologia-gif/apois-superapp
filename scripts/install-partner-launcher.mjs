import './harden-partner-android-security.mjs';
import './configure-partner-firebase.mjs';
import './install-partner-driver-location.mjs';
import './install-partner-courier-location.mjs';
import './harden-partner-location-startup-ack.mjs';
import './harden-partner-location-session-sync.mjs';
import './harden-partner-location-notification-routing.mjs';
// verify-partner-native-plugins roda via await no fim, depois de todos os hardeners.
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const resRoot = resolve('superapp/partner-shell/android/app/src/main/res');
const manifestPath = resolve('superapp/partner-shell/android/app/src/main/AndroidManifest.xml');
const mainActivityPath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/MainActivity.java');
const driverLocationPluginPath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/DriverLocationPlugin.java');
const driverLocationServicePath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/DriverLocationService.java');
const courierLocationPluginPath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/CourierLocationPlugin.java');
const courierLocationServicePath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/CourierLocationService.java');

if (!existsSync(resRoot)) throw new Error(`Recursos Android do APOIS Parceiro não encontrados: ${resRoot}`);

function removeStaleLauncherBitmaps(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (!/^ic_launcher(?:_round|_foreground|_background)?\.(?:png|webp|jpe?g)$/i.test(entry)) continue;
    rmSync(join(dir, entry), { force: true });
  }
}

for (const density of ['mipmap-mdpi','mipmap-hdpi','mipmap-xhdpi','mipmap-xxhdpi','mipmap-xxxhdpi']) {
  removeStaleLauncherBitmaps(join(resRoot, density));
}

const drawableDir = join(resRoot, 'drawable');
const legacyAnyDpi = join(resRoot, 'mipmap-anydpi');
const adaptiveDir = join(resRoot, 'mipmap-anydpi-v26');
mkdirSync(drawableDir, { recursive: true });
mkdirSync(legacyAnyDpi, { recursive: true });
mkdirSync(adaptiveDir, { recursive: true });

for (const stale of [
  'apois_launcher_a.xml',
  'apois_launcher_a_monochrome.xml',
  'ic_launcher_monochrome.xml',
  'ic_launcher_foreground.xml',
]) {
  rmSync(join(drawableDir, stale), { force: true });
}

const backgroundDrawable = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFF" />
</shape>
`;
writeFileSync(join(drawableDir, 'apois_launcher_background.xml'), backgroundDrawable, 'utf8');

const markVector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="512"
    android:viewportHeight="512">
    <path android:fillColor="#E51B23" android:pathData="M86,386 L210,118 L270,118 L150,386 Z" />
    <path android:fillColor="#C9141B" android:pathData="M250,118 L310,118 L430,386 L355,386 Z" />
    <path android:fillColor="#111111" android:pathData="M148,314 L356,314 L390,386 L116,386 Z" />
    <path android:fillColor="#242424" android:pathData="M238,181 L215,232 L256,232 L278,181 Z" />
    <path android:fillColor="#242424" android:pathData="M275,248 L254,294 L295,294 L315,248 Z" />
</vector>
`;
writeFileSync(join(drawableDir, 'apois_launcher_mark.xml'), markVector, 'utf8');

const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@drawable/apois_launcher_background" />
    <item android:gravity="center">
        <inset
            android:drawable="@drawable/apois_launcher_mark"
            android:insetLeft="18dp"
            android:insetTop="18dp"
            android:insetRight="18dp"
            android:insetBottom="18dp" />
    </item>
</layer-list>
`;
writeFileSync(join(legacyAnyDpi, 'ic_launcher.xml'), legacyXml, 'utf8');
writeFileSync(join(legacyAnyDpi, 'ic_launcher_round.xml'), legacyXml, 'utf8');

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/apois_launcher_background" />
    <foreground android:drawable="@drawable/apois_launcher_mark" />
</adaptive-icon>
`;
writeFileSync(join(adaptiveDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
writeFileSync(join(adaptiveDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

const installedMark = readFileSync(join(drawableDir, 'apois_launcher_mark.xml'), 'utf8');
if (!installedMark.includes('#E51B23') || !installedMark.includes('#111111')) {
  throw new Error('Launcher Parceiro não usa o símbolo oficial vermelho/preto da identidade APOIS.');
}
const manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) throw new Error('Manifest Parceiro não aponta para @mipmap/ic_launcher');
if (!manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) throw new Error('Manifest Parceiro não aponta para @mipmap/ic_launcher_round');
if (!manifest.includes('android:allowBackup="false"')) throw new Error('Manifest Parceiro ainda permite backup de sessão.');
if (!manifest.includes('android:usesCleartextTraffic="false"')) throw new Error('Manifest Parceiro ainda permite tráfego HTTP cleartext.');
if (!manifest.includes('android:scheme="br.com.apois.parceiro"')) throw new Error('Manifest Parceiro não registra o scheme próprio.');
if (!manifest.includes('android.permission.FOREGROUND_SERVICE_LOCATION')) throw new Error('Manifest Parceiro não permite serviços de localização foreground.');
if (!manifest.includes('android:name=".DriverLocationService"')) throw new Error('Manifest Parceiro não registra DriverLocationService.');
if (!manifest.includes('android:name=".CourierLocationService"')) throw new Error('Manifest Parceiro não registra CourierLocationService.');
if (manifest.includes('android.permission.ACCESS_BACKGROUND_LOCATION')) throw new Error('Manifest Parceiro não deve solicitar ACCESS_BACKGROUND_LOCATION.');
if (manifest.includes('android:scheme="br.com.apois.app"') && manifest.includes('android:pathPrefix="/mercadopago"')) throw new Error('Manifest Parceiro ainda registra callback Mercado Pago do app cliente.');
if (!existsSync(resolve('superapp/partner-shell/android/app/google-services.json'))) throw new Error('Firebase do APOIS Parceiro não foi materializado.');
if (!existsSync(driverLocationPluginPath) || !existsSync(driverLocationServicePath)) throw new Error('Runtime nativo de localização do Motorista não foi instalado.');
if (!existsSync(courierLocationPluginPath) || !existsSync(courierLocationServicePath)) throw new Error('Runtime nativo de localização do Entregador não foi instalado.');
const driverPlugin = readFileSync(driverLocationPluginPath, 'utf8');
const driverService = readFileSync(driverLocationServicePath, 'utf8');
const courierPlugin = readFileSync(courierLocationPluginPath, 'utf8');
const courierService = readFileSync(courierLocationServicePath, 'utf8');
if (!driverService.includes('br.com.apois.parceiro://module/motorista')) throw new Error('Notificação de GPS do Motorista não retorna ao módulo Motorista.');
if (!courierService.includes('br.com.apois.parceiro://module/entregador')) throw new Error('Notificação de GPS do Entregador não retorna ao módulo Entregador.');
for (const [label, plugin, service, key] of [
  ['Motorista', driverPlugin, driverService, 'driver_running'],
  ['Entregador', courierPlugin, courierService, 'courier_running'],
]) {
  if (!plugin.includes(`STARTUP_KEY = "${key}"`) || !plugin.includes('STARTUP_ACK_DELAY_MS = 900L') || !plugin.includes('startup.getBoolean(STARTUP_KEY, false)')) {
    throw new Error(`${label}: plugin de localização ainda pode confirmar started=true antes do Foreground Service.`);
  }
  if (!service.includes('setStartupConfirmed(true);') || !service.includes('setStartupConfirmed(false);')) {
    throw new Error(`${label}: serviço de localização não publica confirmação real de start/stop.`);
  }
  if (!plugin.includes('public void session(PluginCall call)') || !plugin.includes('apois_partner_location_session')) {
    throw new Error(`${label}: plugin de localização não expõe a sessão nativa mais recente para reconciliação segura da WebView.`);
  }
  if (!service.includes('private void persistSessionTokens()') || !service.includes('persistSessionTokens();')) {
    throw new Error(`${label}: serviço de localização não persiste tokens renovados para evitar divergência de sessão.`);
  }
}
const mainActivity = readFileSync(mainActivityPath, 'utf8');
if (!mainActivity.includes('registerPlugin(DriverVoicePlugin.class)')) throw new Error('DriverVoicePlugin não registrado no host Parceiro.');
if (!mainActivity.includes('registerPlugin(DriverLocationPlugin.class)')) throw new Error('DriverLocationPlugin não registrado no host Parceiro.');
if (!mainActivity.includes('registerPlugin(CourierLocationPlugin.class)')) throw new Error('CourierLocationPlugin não registrado no host Parceiro.');

await import('./verify-partner-native-plugins.mjs');
console.log('[OK] Launcher APOIS Parceiro usa símbolo vetorial oficial vermelho/preto sobre fundo branco; runtime nativo preservado e validado.');
