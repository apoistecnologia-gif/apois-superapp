import './harden-partner-mercadopago-callback.mjs';
import './harden-partner-android-security.mjs';
import './configure-partner-firebase.mjs';
import './install-partner-driver-location.mjs';
import './install-partner-courier-location.mjs';
import './harden-partner-location-startup-ack.mjs';
import './harden-partner-location-session-sync.mjs';
import './harden-partner-location-notification-routing.mjs';
// verify-partner-native-plugins roda via await no fim, depois de todos os hardeners.
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const resRoot = resolve('superapp/partner-shell/android/app/src/main/res');
const manifestPath = resolve('superapp/partner-shell/android/app/src/main/AndroidManifest.xml');
const mainActivityPath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/MainActivity.java');
const driverLocationPluginPath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/DriverLocationPlugin.java');
const driverLocationServicePath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/DriverLocationService.java');
const courierLocationPluginPath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/CourierLocationPlugin.java');
const courierLocationServicePath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/CourierLocationService.java');

if (!existsSync(resRoot)) throw new Error(`Recursos Android do APOIS Parceiro não encontrados: ${resRoot}`);

// Launcher determinístico: não depende de PNG raster que pode chegar preto/branco.
// Um único A dourado, pequeno e centralizado, com ampla safe-area.
const drawableDir = join(resRoot, 'drawable');
const valuesDir = join(resRoot, 'values');
const legacyAnyDpi = join(resRoot, 'mipmap-anydpi');
const adaptiveDir = join(resRoot, 'mipmap-anydpi-v26');
for (const dir of [drawableDir, valuesDir, legacyAnyDpi, adaptiveDir]) mkdirSync(dir, { recursive: true });

const goldAPath = 'M54,20 L25,88 L38,88 L44.5,71 L63.5,71 L70,88 L83,88 L54,20 Z M49,59 L54,45 L59,59 Z';
const aVector = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#F6BE1C"
        android:fillType="evenOdd"
        android:pathData="${goldAPath}" />
</vector>
`;
const monoVector = aVector.replace('#F6BE1C', '#FFFFFF');
writeFileSync(join(drawableDir, 'apois_launcher_a.xml'), aVector, 'utf8');
writeFileSync(join(drawableDir, 'apois_launcher_a_monochrome.xml'), monoVector, 'utf8');
writeFileSync(join(valuesDir, 'apois_launcher_colors.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources><color name="ic_launcher_background">#050505</color></resources>
`, 'utf8');

const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item android:drawable="@drawable/apois_launcher_a" />
</layer-list>
`;
writeFileSync(join(legacyAnyDpi, 'ic_launcher.xml'), legacyXml, 'utf8');
writeFileSync(join(legacyAnyDpi, 'ic_launcher_round.xml'), legacyXml, 'utf8');

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/apois_launcher_a" />
    <monochrome android:drawable="@drawable/apois_launcher_a_monochrome" />
</adaptive-icon>
`;
writeFileSync(join(adaptiveDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
writeFileSync(join(adaptiveDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

// Remove bitmaps do template/arte antiga para impedir que algum launcher OEM
// escolha um quadrado preto/branco em vez do recurso anydpi determinístico.
for (const density of ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi']) {
  const dir = join(resRoot, density);
  for (const file of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png', 'ic_launcher.webp', 'ic_launcher_round.webp', 'ic_launcher_foreground.webp']) {
    rmSync(join(dir, file), { force: true });
  }
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
console.log('[OK] Launcher APOIS Parceiro: fundo preto + um único A dourado centralizado; runtime nativo validado.');
