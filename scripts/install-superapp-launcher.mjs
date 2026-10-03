import './harden-superapp-android-security.mjs';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const resRoot = resolve('superapp/shell/android/app/src/main/res');
const manifestPath = resolve('superapp/shell/android/app/src/main/AndroidManifest.xml');
const stringsPath = resolve('superapp/shell/android/app/src/main/res/values/strings.xml');
const APP_LABEL = process.env.APP_LABEL?.trim() || 'APOIS';

if (!existsSync(resRoot)) throw new Error(`Recursos Android não encontrados: ${resRoot}`);

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

const splashXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/white" />
    <item android:gravity="center">
        <inset
            android:drawable="@drawable/apois_launcher_mark"
            android:insetLeft="84dp"
            android:insetTop="84dp"
            android:insetRight="84dp"
            android:insetBottom="84dp" />
    </item>
</layer-list>
`;
writeFileSync(join(drawableDir, 'splash.xml'), splashXml, 'utf8');

if (!existsSync(stringsPath)) throw new Error(`strings.xml não encontrado: ${stringsPath}`);
let stringsXml = readFileSync(stringsPath, 'utf8');
if (/<string name="app_name">[^<]*<\/string>/.test(stringsXml)) {
  stringsXml = stringsXml.replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${APP_LABEL}</string>`);
} else if (stringsXml.includes('</resources>')) {
  stringsXml = stringsXml.replace('</resources>', `    <string name="app_name">${APP_LABEL}</string>\n</resources>`);
} else {
  throw new Error('strings.xml não possui estrutura <resources> válida.');
}
writeFileSync(stringsPath, stringsXml, 'utf8');

const manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) throw new Error('AndroidManifest não aponta para @mipmap/ic_launcher.');
if (!manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) throw new Error('AndroidManifest não aponta para @mipmap/ic_launcher_round.');
if (!manifest.includes('android:allowBackup="false"')) throw new Error('AndroidManifest permite backup de dados do WebView/sessões.');
if (!manifest.includes('android:usesCleartextTraffic="false"')) throw new Error('AndroidManifest não bloqueia tráfego HTTP cleartext.');

const adaptiveInstalled = readFileSync(join(adaptiveDir, 'ic_launcher.xml'), 'utf8');
const splashInstalled = readFileSync(join(drawableDir, 'splash.xml'), 'utf8');
const markInstalled = readFileSync(join(drawableDir, 'apois_launcher_mark.xml'), 'utf8');
if (!adaptiveInstalled.includes('@drawable/apois_launcher_mark')) throw new Error('Ícone adaptativo não usa o símbolo vetorial APOIS.');
if (!splashInstalled.includes('@drawable/apois_launcher_mark')) throw new Error('Splash não usa o símbolo vetorial APOIS.');
if (!markInstalled.includes('#E51B23') || !markInstalled.includes('#111111')) throw new Error('Símbolo APOIS perdeu vermelho/preto oficiais.');
console.log(`[OK] Launcher ${APP_LABEL} usa símbolo vetorial APOIS dedicado, sem crop de wordmark/bitmap.`);
