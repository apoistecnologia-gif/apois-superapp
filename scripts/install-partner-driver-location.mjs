import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const sourceRoot = resolve(root, 'sources/apois-corridas-motorista-admin/android-motorista');
const androidRoot = resolve(root, 'superapp/partner-shell/android');
const javaRoot = resolve(androidRoot, 'app/src/main/java/br/com/apois/parceiro');
const resDrawable = resolve(androidRoot, 'app/src/main/res/drawable');
const manifestPath = resolve(androidRoot, 'app/src/main/AndroidManifest.xml');
const appGradlePath = resolve(androidRoot, 'app/build.gradle');
const mainActivityPath = resolve(javaRoot, 'MainActivity.java');

const sourcePlugin = resolve(sourceRoot, 'app/src/main/java/com/apois/motorista/DriverLocationPlugin.java');
const sourceService = resolve(sourceRoot, 'app/src/main/java/com/apois/motorista/DriverLocationService.java');
const sourceNotificationIcon = resolve(sourceRoot, 'app/src/main/res/drawable/ic_stat_apois_notification.xml');

for (const path of [sourcePlugin, sourceService, sourceNotificationIcon, manifestPath, appGradlePath, mainActivityPath]) {
  if (!existsSync(path)) throw new Error(`APOIS Parceiro: arquivo necessário para localização nativa ausente: ${path}`);
}

mkdirSync(javaRoot, { recursive: true });
mkdirSync(resDrawable, { recursive: true });

function adaptJava(source) {
  return source
    .replaceAll('package com.apois.motorista;', 'package br.com.apois.parceiro;')
    .replaceAll('com.apois.motorista.action.START_LOCATION', 'br.com.apois.parceiro.action.START_DRIVER_LOCATION')
    .replaceAll('com.apois.motorista.action.STOP_LOCATION', 'br.com.apois.parceiro.action.STOP_DRIVER_LOCATION')
    .replace('import android.location.Location;\n', 'import android.location.Location;\nimport android.net.Uri;\n')
    .replace(
      '        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);',
      '        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);\n        openApp.setData(Uri.parse("br.com.apois.parceiro://module/motorista"));',
    );
}

let plugin = adaptJava(readFileSync(sourcePlugin, 'utf8'));
let service = adaptJava(readFileSync(sourceService, 'utf8'));

// O plugin protegido original resolvia started=true imediatamente após pedir
// startForegroundService(). Isso não prova que o Service conseguiu entrar em
// foreground nem registrar LocationUpdates. O host Parceiro exige ACK real do
// próprio Service antes de dizer ao JS que pode permanecer ONLINE.
plugin = plugin
  .replace(
    'import android.content.Intent;\n',
    'import android.content.Intent;\nimport android.content.SharedPreferences;\nimport android.os.Handler;\nimport android.os.Looper;\n',
  )
  .replace(
    'public class DriverLocationPlugin extends Plugin {',
    'public class DriverLocationPlugin extends Plugin {\n    private static final String STARTUP_PREFS = "apois_partner_location_service_status";\n    private static final String STARTUP_KEY = "driver_running";\n    private static final long STARTUP_ACK_DELAY_MS = 900L;',
  )
  .replace(
    `        ContextCompat.startForegroundService(getContext(), intent);\n\n        JSObject result = new JSObject();\n        result.put("started", true);\n        call.resolve(result);`,
    `        SharedPreferences startup = getContext().getSharedPreferences(STARTUP_PREFS, android.content.Context.MODE_PRIVATE);\n        startup.edit().putBoolean(STARTUP_KEY, false).commit();\n        try {\n            ContextCompat.startForegroundService(getContext(), intent);\n        } catch (Exception startError) {\n            call.reject("Não foi possível iniciar a localização do motorista em segundo plano.", startError);\n            return;\n        }\n\n        new Handler(Looper.getMainLooper()).postDelayed(() -> {\n            boolean started = startup.getBoolean(STARTUP_KEY, false);\n            if (!started) {\n                call.reject("O serviço de localização do motorista não confirmou a inicialização.");\n                return;\n            }\n            JSObject result = new JSObject();\n            result.put("started", true);\n            call.resolve(result);\n        }, STARTUP_ACK_DELAY_MS);`,
  );

service = service
  .replace(
    'public class DriverLocationService extends Service {',
    'public class DriverLocationService extends Service {\n    private static final String STARTUP_PREFS = "apois_partner_location_service_status";\n    private static final String STARTUP_KEY = "driver_running";',
  )
  .replace(
    `        if (supabaseUrl.isEmpty() || publishableKey.isEmpty() || accessToken.isEmpty()) {\n            stopSelf();`,
    `        if (supabaseUrl.isEmpty() || publishableKey.isEmpty() || accessToken.isEmpty()) {\n            setStartupConfirmed(false);\n            stopSelf();`,
  )
  .replace(
    '    private void startLocationUpdates() {\n        if (tracking) return;',
    '    private void startLocationUpdates() {\n        if (tracking) { setStartupConfirmed(true); return; }',
  )
  .replace(
    `        if (!fine && !coarse) {\n            stopSelf();`,
    `        if (!fine && !coarse) {\n            setStartupConfirmed(false);\n            stopSelf();`,
  )
  .replace(
    `            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());\n            mainHandler.removeCallbacks(heartbeat);`,
    `            fusedLocationClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper());\n            setStartupConfirmed(true);\n            mainHandler.removeCallbacks(heartbeat);`,
  )
  .replace(
    `        } catch (SecurityException securityException) {\n            tracking = false;\n            stopSelf();`,
    `        } catch (SecurityException securityException) {\n            tracking = false;\n            setStartupConfirmed(false);\n            stopSelf();`,
  )
  .replace(
    '    private void clearPendingLocation() {',
    '    private void setStartupConfirmed(boolean running) {\n        getSharedPreferences(STARTUP_PREFS, MODE_PRIVATE).edit().putBoolean(STARTUP_KEY, running).commit();\n    }\n\n    private void clearPendingLocation() {',
  )
  .replace(
    '    private void stopFromDriverAction() {\n        tracking = false;',
    '    private void stopFromDriverAction() {\n        setStartupConfirmed(false);\n        tracking = false;',
  )
  .replace(
    '    @Override\n    public void onDestroy() {',
    '    @Override\n    public void onDestroy() {\n        setStartupConfirmed(false);',
  );

if (!plugin.includes('@CapacitorPlugin(name = "DriverLocation")')) {
  throw new Error('APOIS Parceiro: plugin DriverLocation protegido não foi reconhecido.');
}
for (const marker of [
  'STARTUP_ACK_DELAY_MS = 900L',
  'startup.edit().putBoolean(STARTUP_KEY, false).commit()',
  'boolean started = startup.getBoolean(STARTUP_KEY, false)',
  'O serviço de localização do motorista não confirmou a inicialização.',
]) {
  if (!plugin.includes(marker)) throw new Error(`APOIS Parceiro: ACK real do DriverLocationPlugin incompleto (${marker}).`);
}
for (const marker of [
  'FOREGROUND_SERVICE_TYPE_LOCATION',
  'driver_set_presence',
  'private void setStartupConfirmed(boolean running)',
  'setStartupConfirmed(true);',
  'setStartupConfirmed(false);',
]) {
  if (!service.includes(marker)) throw new Error(`APOIS Parceiro: serviço protegido de localização do Motorista está incompleto (${marker}).`);
}
if (!service.includes('br.com.apois.parceiro://module/motorista')) {
  throw new Error('APOIS Parceiro: notificação persistente do Motorista não retorna ao módulo correto.');
}
writeFileSync(resolve(javaRoot, 'DriverLocationPlugin.java'), plugin, 'utf8');
writeFileSync(resolve(javaRoot, 'DriverLocationService.java'), service, 'utf8');
copyFileSync(sourceNotificationIcon, resolve(resDrawable, 'ic_stat_apois_notification.xml'));

let mainActivity = readFileSync(mainActivityPath, 'utf8');
if (!mainActivity.includes('registerPlugin(DriverVoicePlugin.class)')) {
  throw new Error('APOIS Parceiro: DriverVoice precisa estar registrado antes de instalar DriverLocation.');
}
if (!mainActivity.includes('registerPlugin(DriverLocationPlugin.class)')) {
  mainActivity = mainActivity.replace(
    '        registerPlugin(DriverVoicePlugin.class);',
    '        registerPlugin(DriverVoicePlugin.class);\n        registerPlugin(DriverLocationPlugin.class);',
  );
}
writeFileSync(mainActivityPath, mainActivity, 'utf8');

let manifest = readFileSync(manifestPath, 'utf8');
function ensurePermission(name) {
  if (manifest.includes(`android:name="${name}"`)) return;
  manifest = manifest.replace('<application', `    <uses-permission android:name="${name}" />\n\n    <application`);
}
ensurePermission('android.permission.FOREGROUND_SERVICE');
ensurePermission('android.permission.FOREGROUND_SERVICE_LOCATION');

if (!manifest.includes('android:name="com.google.firebase.messaging.default_notification_icon"')) {
  const iconMeta = `\n        <meta-data\n            android:name="com.google.firebase.messaging.default_notification_icon"\n            android:resource="@drawable/ic_stat_apois_notification" />\n`;
  manifest = manifest.replace('</application>', `${iconMeta}    </application>`);
}

if (!manifest.includes('android:name=".DriverLocationService"')) {
  const serviceXml = `\n        <service\n            android:name=".DriverLocationService"\n            android:exported="false"\n            android:foregroundServiceType="location"\n            android:stopWithTask="false" />\n`;
  manifest = manifest.replace('</application>', `${serviceXml}    </application>`);
}
manifest = manifest.replace(/\s*<uses-permission\s+android:name="android\.permission\.ACCESS_BACKGROUND_LOCATION"\s*\/?>\s*/g, '\n');
writeFileSync(manifestPath, manifest, 'utf8');

let gradle = readFileSync(appGradlePath, 'utf8');
if (!gradle.includes('com.google.android.gms:play-services-location:21.3.0')) {
  const dependencyAnchor = "    implementation project(':capacitor-android')";
  if (!gradle.includes(dependencyAnchor)) {
    throw new Error('APOIS Parceiro: âncora de dependência capacitor-android não encontrada.');
  }
  gradle = gradle.replace(
    dependencyAnchor,
    `    implementation \"com.google.android.gms:play-services-location:21.3.0\"\n${dependencyAnchor}`,
  );
}
writeFileSync(appGradlePath, gradle, 'utf8');

const finalManifest = readFileSync(manifestPath, 'utf8');
const finalMain = readFileSync(mainActivityPath, 'utf8');
const finalGradle = readFileSync(appGradlePath, 'utf8');
for (const marker of [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_LOCATION',
  'android:name=".DriverLocationService"',
  'android:foregroundServiceType="location"',
  'android:name="com.google.firebase.messaging.default_notification_icon"',
  'android:resource="@drawable/ic_stat_apois_notification"',
]) {
  if (!finalManifest.includes(marker)) throw new Error(`APOIS Parceiro: localização/notificação nativa incompleta no Manifest (${marker}).`);
}
if (finalManifest.includes('android.permission.ACCESS_BACKGROUND_LOCATION')) {
  throw new Error('APOIS Parceiro: ACCESS_BACKGROUND_LOCATION reapareceu indevidamente.');
}
if (!finalMain.includes('registerPlugin(DriverLocationPlugin.class)')) {
  throw new Error('APOIS Parceiro: DriverLocationPlugin não foi registrado na MainActivity.');
}
if (!finalGradle.includes('com.google.android.gms:play-services-location:21.3.0')) {
  throw new Error('APOIS Parceiro: dependência nativa de localização ausente.');
}
if (!existsSync(resolve(resDrawable, 'ic_stat_apois_notification.xml'))) {
  throw new Error('APOIS Parceiro: ícone da notificação de localização ausente.');
}

console.log('[OK] APOIS Parceiro: DriverLocation só confirma started após ACK real do Service; notificação persistente retorna ao Motorista, com heartbeat Supabase e ícone APOIS.');
