import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('superapp/shell/android/app/src/main/AndroidManifest.xml');
const variablesGradlePath = resolve('superapp/shell/android/variables.gradle');
const appGradlePath = resolve('superapp/shell/android/app/build.gradle');
const resXmlDir = resolve('superapp/shell/android/app/src/main/res/xml');
const backupRulesPath = resolve(resXmlDir, 'apois_backup_rules.xml');
const dataExtractionRulesPath = resolve(resXmlDir, 'apois_data_extraction_rules.xml');

let xml = readFileSync(manifestPath, 'utf8');

function setApplicationAttribute(name, value) {
  const pattern = new RegExp(`android:${name}="[^"]*"`);
  if (pattern.test(xml)) {
    xml = xml.replace(pattern, `android:${name}="${value}"`);
    return;
  }
  xml = xml.replace('<application', `<application\n        android:${name}="${value}"`);
}

// O APK armazena sessões Supabase e estado operacional no WebView. Não permita
// que o Android restaure esse conteúdo automaticamente em outro aparelho/instalação.
setApplicationAttribute('allowBackup', 'false');

// Android 12+ pode ignorar allowBackup durante migração device-to-device.
// Mantemos também regras explícitas para cloud backup e device transfer, além da
// política legada usada por Android 11 e anteriores.
setApplicationAttribute('fullBackupContent', '@xml/apois_backup_rules');
setApplicationAttribute('dataExtractionRules', '@xml/apois_data_extraction_rules');

mkdirSync(resXmlDir, { recursive: true });
const backupRules = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
</full-backup-content>
`;
const dataExtractionRules = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
    <cloud-backup>
        <exclude domain="root" path="." />
        <exclude domain="file" path="." />
        <exclude domain="database" path="." />
        <exclude domain="sharedpref" path="." />
        <exclude domain="external" path="." />
    </cloud-backup>
    <device-transfer>
        <exclude domain="root" path="." />
        <exclude domain="file" path="." />
        <exclude domain="database" path="." />
        <exclude domain="sharedpref" path="." />
        <exclude domain="external" path="." />
    </device-transfer>
</data-extraction-rules>
`;
writeFileSync(backupRulesPath, backupRules, 'utf8');
writeFileSync(dataExtractionRulesPath, dataExtractionRules, 'utf8');

// Todas as APIs usadas pelo Superapp são HTTPS. Bloquear cleartext reduz o risco
// de downgrade/acesso acidental a endpoints HTTP em produção. Google Maps, OAuth,
// deep links, FCM e o bridge do Capacitor não dependem de HTTP cleartext.
setApplicationAttribute('usesCleartextTraffic', 'false');

// O Superapp só usa localização enquanto a interface está ativa. Não publique
// permissão de localização em segundo plano sem necessidade operacional/política.
xml = xml.replace(/\s*<uses-permission\s+android:name="android\.permission\.ACCESS_BACKGROUND_LOCATION"\s*\/?>\s*/g, '\n');

// Mantém formulários utilizáveis com teclado e edge-to-edge recentes.
if (!xml.includes('android:windowSoftInputMode=')) {
  xml = xml.replace('<activity', '<activity\n            android:windowSoftInputMode="adjustResize"');
}

writeFileSync(manifestPath, xml, 'utf8');

// Capacitor 8.5 suporta Android 16. Fixamos API 36 para que o artefato continue
// publicável após a exigência da Play Store de 31/08/2026.
if (!existsSync(variablesGradlePath)) {
  throw new Error(`variables.gradle Android ausente: ${variablesGradlePath}`);
}
let variablesGradle = readFileSync(variablesGradlePath, 'utf8');
const sdkFields = [
  ['compileSdkVersion', 36],
  ['targetSdkVersion', 36],
];
for (const [field, value] of sdkFields) {
  const pattern = new RegExp(`(${field}\\s*=\\s*)\\d+`);
  if (!pattern.test(variablesGradle)) {
    throw new Error(`Campo Android ${field} não encontrado em variables.gradle.`);
  }
  variablesGradle = variablesGradle.replace(pattern, `$1${value}`);
}
writeFileSync(variablesGradlePath, variablesGradle, 'utf8');

// Versionamento explícito para o release; o pipeline precisa fornecê-lo.
if (!existsSync(appGradlePath)) {
  throw new Error(`build.gradle Android ausente: ${appGradlePath}`);
}
const versionCodeRaw = process.env.APP_VERSION_CODE?.trim();
const versionName = process.env.APP_VERSION_NAME?.trim();
if (!versionCodeRaw || !versionName) {
  throw new Error('APP_VERSION_CODE e APP_VERSION_NAME são obrigatórios no release.');
}
const versionCode = Number.parseInt(versionCodeRaw, 10);
if (!/^\d+$/.test(versionCodeRaw) || !Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error('APP_VERSION_CODE deve ser inteiro positivo.');
}
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(versionName)) {
  throw new Error('APP_VERSION_NAME deve usar formato semântico, por exemplo 1.0.0.');
}
let appGradle = readFileSync(appGradlePath, 'utf8');
if (!/versionCode\s+\d+/.test(appGradle) || !/versionName\s+"[^"]+"/.test(appGradle)) {
  throw new Error('versionCode/versionName não encontrados no build.gradle gerado.');
}
appGradle = appGradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`);
writeFileSync(appGradlePath, appGradle, 'utf8');

const finalXml = readFileSync(manifestPath, 'utf8');
for (const marker of [
  'android:allowBackup="false"',
  'android:usesCleartextTraffic="false"',
  'android:fullBackupContent="@xml/apois_backup_rules"',
  'android:dataExtractionRules="@xml/apois_data_extraction_rules"',
  'android:windowSoftInputMode="adjustResize"',
]) {
  if (!finalXml.includes(marker)) {
    throw new Error(`Hardening Android não aplicado: ${marker}`);
  }
}
for (const forbidden of [
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.REQUEST_INSTALL_PACKAGES',
  'android.permission.WRITE_EXTERNAL_STORAGE',
]) {
  if (finalXml.includes(forbidden)) {
    throw new Error(`Permissão Android desnecessária/perigosa detectada: ${forbidden}`);
  }
}

for (const [path, markers] of [
  [backupRulesPath, ['<full-backup-content>', '<exclude domain="root" path="." />', '<exclude domain="sharedpref" path="." />']],
  [dataExtractionRulesPath, ['<data-extraction-rules>', '<cloud-backup>', '<device-transfer>', '<exclude domain="database" path="." />']],
]) {
  if (!existsSync(path)) throw new Error(`Regra Android de backup ausente: ${path}`);
  const source = readFileSync(path, 'utf8');
  for (const marker of markers) {
    if (!source.includes(marker)) throw new Error(`Regra Android de backup incompleta em ${path}: ${marker}`);
  }
}

const finalVariables = readFileSync(variablesGradlePath, 'utf8');
if (!/compileSdkVersion\s*=\s*36/.test(finalVariables) || !/targetSdkVersion\s*=\s*36/.test(finalVariables)) {
  throw new Error('Android não ficou fixado em compileSdk/targetSdk 36.');
}
const finalGradle = readFileSync(appGradlePath, 'utf8');
if (!finalGradle.includes(`versionCode ${versionCode}`) || !finalGradle.includes(`versionName "${versionName}"`)) {
  throw new Error('Versionamento Android não foi aplicado ao release.');
}

console.log(`[OK] Android Play-ready: API 36, version ${versionName} (${versionCode}), backup/D2D/cleartext/background-location endurecidos.`);
