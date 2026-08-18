import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const APP_PACKAGE = process.env.APP_PACKAGE?.trim() || 'br.com.apois.app';
const androidRoot = resolve('superapp/shell/android');
const appRoot = join(androidRoot, 'app');
const manifestPath = join(appRoot, 'src/main/AndroidManifest.xml');
let xml = readFileSync(manifestPath, 'utf8');

const permissions = [
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.POST_NOTIFICATIONS',
];

for (const permission of permissions) {
  if (!xml.includes(permission)) {
    xml = xml.replace(
      '<application',
      `    <uses-permission android:name="${permission}" />\n\n    <application`,
    );
  }
}

if (!xml.includes('android:scheme="br.com.apois.app"')) {
  const marker = '</activity>';
  const intentFilter = `
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="br.com.apois.app" android:host="auth" />
            </intent-filter>
`;
  xml = xml.replace(marker, `${intentFilter}        ${marker}`);
}

const mapsKey = process.env.CORRIDAS_ANDROID_MAPS_API_KEY?.trim();
if (mapsKey && !xml.includes('com.google.android.geo.API_KEY')) {
  xml = xml.replace(
    '</application>',
    `        <meta-data android:name="com.google.android.geo.API_KEY" android:value="${mapsKey.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}" />\n    </application>`,
  );
}

writeFileSync(manifestPath, xml);
console.log('[OK] AndroidManifest do APOIS Superapp configurado.');

// Capacitor 8 already ships the Google Services Gradle hook in the generated
// app module. Validate that invariant instead of patching Gradle blindly.
const appGradlePath = join(appRoot, 'build.gradle');
const appGradle = readFileSync(appGradlePath, 'utf8');
if (!appGradle.includes("apply plugin: 'com.google.gms.google-services'") || !appGradle.includes("file('google-services.json')")) {
  throw new Error('Projeto Android gerado não contém o hook padrão do Google Services esperado pelo Capacitor 8.');
}
console.log('[OK] Android gerado contém hook condicional do Google Services/FCM.');

const firebaseB64 = process.env.FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64?.trim();
if (firebaseB64) {
  let firebaseConfig;
  try {
    firebaseConfig = JSON.parse(Buffer.from(firebaseB64, 'base64').toString('utf8'));
  } catch (error) {
    throw new Error(`Firebase do Superapp inválido: ${error instanceof Error ? error.message : String(error)}`);
  }

  const packages = (Array.isArray(firebaseConfig?.client) ? firebaseConfig.client : [])
    .map((client) => client?.client_info?.android_client_info?.package_name)
    .filter(Boolean);
  if (!packages.includes(APP_PACKAGE)) {
    throw new Error(`google-services.json não contém ${APP_PACKAGE}; encontrados: ${packages.join(', ') || 'nenhum'}`);
  }

  writeFileSync(
    join(appRoot, 'google-services.json'),
    `${JSON.stringify(firebaseConfig, null, 2)}\n`,
    'utf8',
  );
  console.log(`[OK] Firebase unificado materializado e validado para ${APP_PACKAGE}.`);
} else {
  console.warn('[WARN] Firebase unificado ainda não foi fornecido; Push permanecerá desabilitado no Superapp.');
}

const resRoot = join(appRoot, 'src/main/res');
const brandingCandidates = [
  resolve('.work/corridas/dist/favicon.png'),
  resolve('.work/corridas/public/favicon.png'),
  resolve('.work/entregas/.output/public/apois-app-icon.png'),
];
const brandingIcon = brandingCandidates.find((candidate) => existsSync(candidate));

if (brandingIcon && existsSync(resRoot)) {
  let replaced = 0;
  for (const dirName of readdirSync(resRoot)) {
    if (!dirName.startsWith('mipmap-') && !dirName.startsWith('drawable')) continue;
    const dirPath = join(resRoot, dirName);
    let entries = [];
    try {
      entries = readdirSync(dirPath);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.png')) continue;
      const fileName = basename(entry);
      if (!fileName.startsWith('ic_launcher') && !fileName.startsWith('splash')) continue;
      copyFileSync(brandingIcon, join(dirPath, entry));
      replaced += 1;
    }
  }

  const colorsPath = join(resRoot, 'values', 'colors.xml');
  if (existsSync(colorsPath)) {
    let colors = readFileSync(colorsPath, 'utf8');
    colors = colors.replace(
      /<color name="ic_launcher_background">[^<]*<\/color>/,
      '<color name="ic_launcher_background">#050505</color>',
    );
    writeFileSync(colorsPath, colors);
  }

  console.log(`[OK] Branding Android aplicado usando ${brandingIcon} (${replaced} imagens substituídas).`);
} else {
  console.warn('[WARN] Branding Android: ícone APOIS não encontrado; mantendo recursos padrão do Capacitor.');
}
