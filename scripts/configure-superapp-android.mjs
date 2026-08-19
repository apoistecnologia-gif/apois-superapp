import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

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
const drawableDir = join(resRoot, 'drawable');
const mipmapAdaptiveDir = join(resRoot, 'mipmap-anydpi-v26');
mkdirSync(drawableDir, { recursive: true });
mkdirSync(mipmapAdaptiveDir, { recursive: true });

// APOIS Brasil launcher mark: gold stylized A over black. Kept as vector so
// Android adaptive/round launchers never fall back to Capacitor's blue icon.
const launcherForegroundXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="432"
    android:viewportHeight="432">
    <path
        android:fillColor="#D4A62A"
        android:pathData="M78,374 L176,68 L226,68 L128,374 Z" />
    <path
        android:fillColor="#F1C84B"
        android:pathData="M204,68 L254,68 L354,374 L304,374 Z" />
    <path
        android:fillColor="#D9AB2B"
        android:pathData="M116,298 C168,248 248,226 328,238 L311,269 C243,258 174,277 129,317 Z" />
    <path
        android:fillColor="#C69218"
        android:pathData="M168,314 C216,278 271,265 317,271 L304,294 C262,291 221,302 183,333 Z" />
</vector>
`;

const launcherMonochromeXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="432"
    android:viewportHeight="432">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M78,374 L176,68 L226,68 L128,374 Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M204,68 L254,68 L354,374 L304,374 Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M116,298 C168,248 248,226 328,238 L311,269 C243,258 174,277 129,317 Z" />
    <path
        android:fillColor="#FFFFFF"
        android:pathData="M168,314 C216,278 271,265 317,271 L304,294 C262,291 221,302 183,333 Z" />
</vector>
`;

const adaptiveIconXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`;

const splashXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/black" />
    <item android:gravity="center">
        <inset
            android:drawable="@drawable/ic_launcher_foreground"
            android:insetLeft="72dp"
            android:insetTop="72dp"
            android:insetRight="72dp"
            android:insetBottom="72dp" />
    </item>
</layer-list>
`;

writeFileSync(join(drawableDir, 'ic_launcher_foreground.xml'), launcherForegroundXml, 'utf8');
writeFileSync(join(drawableDir, 'ic_launcher_monochrome.xml'), launcherMonochromeXml, 'utf8');
writeFileSync(join(mipmapAdaptiveDir, 'ic_launcher.xml'), adaptiveIconXml, 'utf8');
writeFileSync(join(mipmapAdaptiveDir, 'ic_launcher_round.xml'), adaptiveIconXml, 'utf8');
writeFileSync(join(drawableDir, 'splash.xml'), splashXml, 'utf8');

const colorsPath = join(resRoot, 'values', 'colors.xml');
if (existsSync(colorsPath)) {
  let colors = readFileSync(colorsPath, 'utf8');
  colors = colors.replace(
    /<color name="ic_launcher_background">[^<]*<\/color>/,
    '<color name="ic_launcher_background">#050505</color>',
  );
  writeFileSync(colorsPath, colors);
}

console.log('[OK] Ícone adaptativo, redondo, monocromático e splash do Superapp preparados com identidade APOIS Brasil.');
