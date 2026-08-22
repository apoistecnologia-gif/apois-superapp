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
    .replaceAll('com.apois.motorista.action.STOP_LOCATION', 'br.com.apois.parceiro.action.STOP_DRIVER_LOCATION');
}

const plugin = adaptJava(readFileSync(sourcePlugin, 'utf8'));
const service = adaptJava(readFileSync(sourceService, 'utf8'));
if (!plugin.includes('@CapacitorPlugin(name = "DriverLocation")')) {
  throw new Error('APOIS Parceiro: plugin DriverLocation protegido não foi reconhecido.');
}
if (!service.includes('FOREGROUND_SERVICE_TYPE_LOCATION') || !service.includes('driver_set_presence')) {
  throw new Error('APOIS Parceiro: serviço protegido de localização do Motorista está incompleto.');
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
// O serviço é iniciado somente com a Activity visível e permanece como Foreground Service.
// Por isso o APK Parceiro NÃO solicita ACCESS_BACKGROUND_LOCATION, evitando uma permissão
// de alto risco desnecessária para este contrato operacional.
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

console.log('[OK] APOIS Parceiro: DriverLocation nativo instalado com Foreground Service, heartbeat Supabase, refresh de sessão e ícone APOIS também aplicado ao FCM.');
