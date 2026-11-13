import './harden-partner-android-security.mjs';
import './configure-partner-firebase.mjs';
import './install-partner-driver-location.mjs';
import './install-partner-courier-location.mjs';
import './harden-partner-location-startup-ack.mjs';
import './harden-partner-location-session-sync.mjs';
import './harden-partner-location-notification-routing.mjs';
// Shared Google Maps/Waze launcher and return action reuse both existing GPS Services.
import './install-partner-external-navigation.mjs';
// QA235: existing foreground GPS service sends arrival/push even while external Maps is foreground.
import './install-partner-qa235-native-auto-arrival.mjs';
// QA236: return-to-PIN action through the SAME ongoing GPS notification.
import './install-partner-qa236-return-notification-v1.mjs';
// QA239: optional consented overlay on Google Maps/Waze; no new location service.
import './install-partner-qa239-bubble-native-v1.mjs';
// verify-partner-native-plugins roda via await no fim, depois de todos os hardeners.
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const redBrandBase64Source = resolve('superapp/branding/apois-client-red-logo.b64');
const redBrandRasterSource = '/tmp/apois-partner-red-logo.png';
if (!existsSync(redBrandBase64Source)) throw new Error('Arte vermelha oficial APOIS não encontrada para o launcher Parceiro.');
writeFileSync(redBrandRasterSource, Buffer.from(readFileSync(redBrandBase64Source, 'utf8').trim(), 'base64'));
const legacySource = redBrandRasterSource;
const foregroundSource = redBrandRasterSource;
const resRoot = resolve('superapp/partner-shell/android/app/src/main/res');
const manifestPath = resolve('superapp/partner-shell/android/app/src/main/AndroidManifest.xml');
const mainActivityPath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/MainActivity.java');
const driverLocationPluginPath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/DriverLocationPlugin.java');
const driverLocationServicePath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/DriverLocationService.java');
const courierLocationPluginPath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/CourierLocationPlugin.java');
const courierLocationServicePath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/CourierLocationService.java');

for (const source of [legacySource, foregroundSource]) {
  if (!existsSync(source)) throw new Error(`Arte oficial APOIS não encontrada: ${source}`);
}
if (!existsSync(resRoot)) throw new Error(`Recursos Android do APOIS Parceiro não encontrados: ${resRoot}`);

function resizePng(source, size, output) {
  const result = spawnSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), source, '--out', output], { encoding: 'utf8' });
  if (!result.error && result.status === 0 && existsSync(output)) return;
  // sips is macOS-only. On Windows/Linux, retain the official PNG rather than
  // falling back to a synthetic icon; Android accepts the source as a valid raster.
  copyFileSync(source, output);
}

function removeStaleLauncherBitmaps(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (!/^ic_launcher(?:_round|_foreground|_background)?\.(?:png|webp|jpe?g)$/i.test(entry)) continue;
    rmSync(join(dir, entry), { force: true });
  }
}

// O visual do launcher vem EXCLUSIVAMENTE das artes oficiais da APOIS.
// Não desenhe/substitua o A por vetor genérico: isso descaracteriza a marca.
const densities = [
  { dir: 'mipmap-mdpi', legacy: 48, foreground: 108 },
  { dir: 'mipmap-hdpi', legacy: 72, foreground: 162 },
  { dir: 'mipmap-xhdpi', legacy: 96, foreground: 216 },
  { dir: 'mipmap-xxhdpi', legacy: 144, foreground: 324 },
  { dir: 'mipmap-xxxhdpi', legacy: 192, foreground: 432 },
];
for (const density of densities) {
  const dir = join(resRoot, density.dir);
  mkdirSync(dir, { recursive: true });
  removeStaleLauncherBitmaps(dir);

  const legacyTmp = `/tmp/apois-partner-launcher-${density.legacy}.png`;
  const foregroundTmp = `/tmp/apois-partner-launcher-foreground-${density.foreground}.png`;
  resizePng(legacySource, density.legacy, legacyTmp);
  resizePng(foregroundSource, density.foreground, foregroundTmp);
  copyFileSync(legacyTmp, join(dir, 'ic_launcher.png'));
  copyFileSync(legacyTmp, join(dir, 'ic_launcher_round.png'));
  copyFileSync(foregroundTmp, join(dir, 'ic_launcher_foreground.png'));
  rmSync(legacyTmp, { force: true });
  rmSync(foregroundTmp, { force: true });
}

const drawableDir = join(resRoot, 'drawable');
const legacyAnyDpi = join(resRoot, 'mipmap-anydpi');
const adaptiveDir = join(resRoot, 'mipmap-anydpi-v26');
mkdirSync(drawableDir, { recursive: true });
mkdirSync(legacyAnyDpi, { recursive: true });
mkdirSync(adaptiveDir, { recursive: true });

// Remove o A artificial criado nas builds anteriores.
rmSync(join(drawableDir, 'apois_launcher_a.xml'), { force: true });
rmSync(join(drawableDir, 'apois_launcher_a_monochrome.xml'), { force: true });
rmSync(join(drawableDir, 'ic_launcher_monochrome.xml'), { force: true });

const backgroundDrawable = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#F7F7F8" />
</shape>
`;
writeFileSync(join(drawableDir, 'apois_launcher_background.xml'), backgroundDrawable, 'utf8');

// Legacy deve usar o raster oficial. XML anydpi antigo pode ganhar prioridade em
// alguns launchers, então é removido deliberadamente.
rmSync(join(legacyAnyDpi, 'ic_launcher.xml'), { force: true });
rmSync(join(legacyAnyDpi, 'ic_launcher_round.xml'), { force: true });

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/apois_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;
writeFileSync(join(adaptiveDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
writeFileSync(join(adaptiveDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

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
console.log('[OK] Launcher APOIS Parceiro usa a arte oficial da marca; A vetorial genérico removido; runtime nativo validado.');
