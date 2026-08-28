import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('superapp/partner-shell/android/app/src/main/AndroidManifest.xml');
const variablesGradlePath = resolve('superapp/partner-shell/android/variables.gradle');
const appGradlePath = resolve('superapp/partner-shell/android/app/build.gradle');

let xml = readFileSync(manifestPath, 'utf8');
function setApplicationAttribute(name, value) {
  const pattern = new RegExp(`android:${name}="[^"]*"`);
  if (pattern.test(xml)) xml = xml.replace(pattern, `android:${name}="${value}"`);
  else xml = xml.replace('<application', `<application\n        android:${name}="${value}"`);
}

setApplicationAttribute('allowBackup', 'false');
setApplicationAttribute('usesCleartextTraffic', 'false');
xml = xml.replace(/\s*<uses-permission\s+android:name="android\.permission\.ACCESS_BACKGROUND_LOCATION"\s*\/?>\s*/g, '\n');
xml = xml.replace(/\s*<uses-permission\s+android:name="android\.permission\.REQUEST_INSTALL_PACKAGES"\s*\/?>\s*/g, '\n');
xml = xml.replace(/\s*<uses-permission\s+android:name="android\.permission\.WRITE_EXTERNAL_STORAGE"[^>]*\/?>\s*/g, '\n');
if (!xml.includes('android:windowSoftInputMode=')) {
  xml = xml.replace('<activity', '<activity\n            android:windowSoftInputMode="adjustResize"');
}
writeFileSync(manifestPath, xml, 'utf8');

if (!existsSync(variablesGradlePath)) throw new Error('variables.gradle do Parceiro não encontrado.');
let variables = readFileSync(variablesGradlePath, 'utf8');
for (const [field, value] of [['compileSdkVersion', 36], ['targetSdkVersion', 36]]) {
  const pattern = new RegExp(`(${field}\\s*=\\s*)\\d+`);
  if (!pattern.test(variables)) throw new Error(`Campo Android ${field} não encontrado no Parceiro.`);
  variables = variables.replace(pattern, `$1${value}`);
}
writeFileSync(variablesGradlePath, variables, 'utf8');

if (!existsSync(appGradlePath)) throw new Error('build.gradle do Parceiro não encontrado.');
const versionCodeRaw = process.env.PARTNER_VERSION_CODE?.trim();
const versionName = process.env.PARTNER_VERSION_NAME?.trim();
if (!versionCodeRaw || !versionName) throw new Error('PARTNER_VERSION_CODE e PARTNER_VERSION_NAME são obrigatórios no release.');
const versionCode = Number.parseInt(versionCodeRaw, 10);
if (!/^\d+$/.test(versionCodeRaw) || !Number.isInteger(versionCode) || versionCode < 1) throw new Error('PARTNER_VERSION_CODE deve ser inteiro positivo.');
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName)) throw new Error('PARTNER_VERSION_NAME deve usar formato semântico.');
let gradle = readFileSync(appGradlePath, 'utf8');
if (!/versionCode\s+\d+/.test(gradle) || !/versionName\s+"[^"]+"/.test(gradle)) throw new Error('Versionamento Android do Parceiro não encontrado.');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`).replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
writeFileSync(appGradlePath, gradle, 'utf8');

const finalXml = readFileSync(manifestPath, 'utf8');
for (const marker of ['android:allowBackup="false"','android:usesCleartextTraffic="false"','android:windowSoftInputMode="adjustResize"']) {
  if (!finalXml.includes(marker)) throw new Error(`Hardening Parceiro ausente: ${marker}`);
}
for (const forbidden of ['android.permission.ACCESS_BACKGROUND_LOCATION','android.permission.REQUEST_INSTALL_PACKAGES','android.permission.WRITE_EXTERNAL_STORAGE']) {
  if (finalXml.includes(forbidden)) throw new Error(`Permissão desnecessária detectada no Parceiro: ${forbidden}`);
}
if (!/compileSdkVersion\s*=\s*36/.test(variables) || !/targetSdkVersion\s*=\s*36/.test(variables)) throw new Error('APOIS Parceiro não ficou em API 36.');

console.log(`[OK] APOIS Parceiro Android endurecido: API 36, version ${versionName} (${versionCode}), backup/cleartext/permissões reduzidos.`);
