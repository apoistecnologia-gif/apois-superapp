import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
const mapsMetaPattern = /<meta-data\s+android:name=["']com\.google\.android\.geo\.API_KEY["']\s+android:value=["'][^"']*["']\s*\/>/;
if (mapsKey) {
  const escapedMapsKey = mapsKey.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const mapsMeta = `<meta-data android:name="com.google.android.geo.API_KEY" android:value="${escapedMapsKey}" />`;
  if (mapsMetaPattern.test(xml)) {
    xml = xml.replace(mapsMetaPattern, mapsMeta);
  } else {
    xml = xml.replace('</application>', `        ${mapsMeta}\n    </application>`);
  }
  if (!xml.includes(escapedMapsKey)) {
    throw new Error('Google Maps Android key não foi materializada no AndroidManifest.');
  }
  console.log('[OK] Google Maps Android key materializada no AndroidManifest.');
} else if (!mapsMetaPattern.test(xml)) {
  // Google Maps SDK aborts the process when its metadata is absent. Keep the
  // debug/local shell launchable without inventing a credential; the runtime
  // will surface the Maps configuration state instead of crashing startup.
  xml = xml.replace(
    '</application>',
    '        <meta-data android:name="com.google.android.geo.API_KEY" android:value="" />\n    </application>',
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
const mipmapAnyDir = join(resRoot, 'mipmap-anydpi');
const mipmapAdaptiveDir = join(resRoot, 'mipmap-anydpi-v26');
const valuesDir = join(resRoot, 'values');
mkdirSync(drawableDir, { recursive: true });
mkdirSync(mipmapAnyDir, { recursive: true });
mkdirSync(mipmapAdaptiveDir, { recursive: true });
mkdirSync(valuesDir, { recursive: true });

// Remove every Capacitor stock launcher/splash bitmap. This prevents older
// Android resource qualifiers from selecting the old white/blue artwork.
let removedStockBranding = 0;
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
    if (!entry.startsWith('ic_launcher') && !entry.startsWith('splash')) continue;
    rmSync(join(dirPath, entry), { force: true });
    removedStockBranding += 1;
  }
}

// Fallback vetorial usado apenas enquanto o projeto nativo está sendo montado.
// O instalador de branding substitui os launchers pelo PNG oficial da APOIS.
const launcherForegroundXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="432"
    android:viewportHeight="432">
    <path
        android:fillColor="#E51B23"
        android:pathData="M78,374 L176,68 L226,68 L128,374 Z" />
    <path
        android:fillColor="#FF3941"
        android:pathData="M204,68 L254,68 L354,374 L304,374 Z" />
    <path
        android:fillColor="#C9141B"
        android:pathData="M116,298 C168,248 248,226 328,238 L311,269 C243,258 174,277 129,317 Z" />
    <path
        android:fillColor="#A90F16"
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

// A splash nativa usa a MESMA arte oficial que será instalada nos mipmaps.
// Assim não aparece mais o símbolo vetorial provisório nem o ícone padrão do
// Android/Capacitor durante a abertura do Superapp.
const splashXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/white" />
    <item android:gravity="center">
        <inset
            android:drawable="@drawable/ic_launcher_foreground"
            android:insetLeft="64dp"
            android:insetTop="64dp"
            android:insetRight="64dp"
            android:insetBottom="64dp" />
    </item>
</layer-list>
`;

writeFileSync(join(drawableDir, 'ic_launcher_foreground.xml'), launcherForegroundXml, 'utf8');
writeFileSync(join(drawableDir, 'ic_launcher_monochrome.xml'), launcherMonochromeXml, 'utf8');
writeFileSync(join(drawableDir, 'splash.xml'), splashXml, 'utf8');
writeFileSync(join(mipmapAnyDir, 'ic_launcher.xml'), launcherForegroundXml, 'utf8');
writeFileSync(join(mipmapAnyDir, 'ic_launcher_round.xml'), launcherForegroundXml, 'utf8');
writeFileSync(join(mipmapAdaptiveDir, 'ic_launcher.xml'), adaptiveIconXml, 'utf8');
writeFileSync(join(mipmapAdaptiveDir, 'ic_launcher_round.xml'), adaptiveIconXml, 'utf8');

// Capacitor 8 already creates values/ic_launcher_background.xml with the
// resource name ic_launcher_background. Update that canonical definition in
// place. Creating a second copy in values/colors.xml makes aapt merge fail with
// a duplicate color resource during assembleRelease.
const launcherBackgroundPath = join(valuesDir, 'ic_launcher_background.xml');
const launcherBackgroundColor = '<color name="ic_launcher_background">#FFFFFF</color>';
if (existsSync(launcherBackgroundPath)) {
  let backgroundValues = readFileSync(launcherBackgroundPath, 'utf8');
  if (/<color name="ic_launcher_background">[^<]*<\/color>/.test(backgroundValues)) {
    backgroundValues = backgroundValues.replace(
      /<color name="ic_launcher_background">[^<]*<\/color>/,
      launcherBackgroundColor,
    );
  } else if (backgroundValues.includes('</resources>')) {
    backgroundValues = backgroundValues.replace(
      '</resources>',
      `    ${launcherBackgroundColor}\n</resources>`,
    );
  } else {
    throw new Error('ic_launcher_background.xml existe, mas não contém um bloco <resources> válido.');
  }
  writeFileSync(launcherBackgroundPath, backgroundValues, 'utf8');
} else {
  writeFileSync(
    launcherBackgroundPath,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    ${launcherBackgroundColor}\n</resources>\n`,
    'utf8',
  );
}

// Clean the transient colors.xml created by the previous Superapp branding
// implementation if this script is rerun in an existing Android tree.
const legacyColorsPath = join(valuesDir, 'colors.xml');
if (existsSync(legacyColorsPath)) {
  let legacyColors = readFileSync(legacyColorsPath, 'utf8');
  legacyColors = legacyColors.replace(
    /\s*<color name="ic_launcher_background">[^<]*<\/color>\s*/,
    '\n',
  );
  const remainingResources = legacyColors
    .replace(/<\?xml[^>]*\?>/g, '')
    .replace(/<\/?resources>/g, '')
    .trim();
  if (!remainingResources) rmSync(legacyColorsPath, { force: true });
  else writeFileSync(legacyColorsPath, legacyColors, 'utf8');
}

// APOIS_CLIENT_LAUNCHER_INSTALL_V1: o Android e recriado do zero em cada build.
// Configurar XMLs nao e suficiente: sem os bitmaps oficiais, o launcher exibe
// o simbolo generico, como ocorreu nos APKs de homologacao do APOIS Cliente.
// O Codemagic ja chama o instalador; executar aqui tambem cobre GitHub Actions.
// A rotina e idempotente e utiliza a mesma marca oficial do APOIS Parceiro.
await import('./install-superapp-launcher.mjs');

const officialLogo = join(resolve('superapp/branding'), 'apois-client-red-logo.b64');
if (!existsSync(officialLogo)) throw new Error('Launcher Cliente: arquivo da marca APOIS ausente.');
const logoBytes = Buffer.from(readFileSync(officialLogo, 'utf8').trim(), 'base64');
if (logoBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
  throw new Error('Launcher Cliente: arte oficial nao e PNG.');
}
const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
for (const density of densities) {
  const dir = join(resRoot, 'mipmap-' + density);
  for (const name of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
    const file = join(dir, name);
    if (!existsSync(file)) throw new Error('Launcher Cliente: falta bitmap oficial em ' + file);
    const image = readFileSync(file);
    if (image.length < 1024 || image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
      throw new Error('Launcher Cliente: bitmap invalido em ' + file);
    }
  }
}
const adaptiveLauncher = readFileSync(join(mipmapAdaptiveDir, 'ic_launcher.xml'), 'utf8');
const adaptiveRound = readFileSync(join(mipmapAdaptiveDir, 'ic_launcher_round.xml'), 'utf8');
for (const content of [adaptiveLauncher, adaptiveRound]) {
  if (!content.includes('<adaptive-icon') || !content.includes('@mipmap/ic_launcher_foreground')) {
    throw new Error('Launcher Cliente: icone adaptativo nao aponta para a marca oficial.');
  }
}
if (existsSync(join(mipmapAnyDir, 'ic_launcher.xml')) || existsSync(join(mipmapAnyDir, 'ic_launcher_round.xml'))) {
  throw new Error('Launcher Cliente: XML legado anydpi pode sobrepor a marca oficial.');
}
const finalManifest = readFileSync(manifestPath, 'utf8');
if (!finalManifest.includes('android:icon="@mipmap/ic_launcher"') || !finalManifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) {
  throw new Error('Launcher Cliente: manifest nao utiliza os icones oficiais.');
}
console.log(`[OK] APOIS_CLIENT_LAUNCHER_INSTALL_V1: ${densities.length} densidades, icon normal/redondo/adaptativo e splash com marca APOIS oficial; ${removedStockBranding} bitmaps de template descartados.`);
