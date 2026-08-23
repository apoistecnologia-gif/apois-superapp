import './harden-superapp-android-security.mjs';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const resRoot = resolve('superapp/shell/android/app/src/main/res');
const manifestPath = resolve('superapp/shell/android/app/src/main/AndroidManifest.xml');
const stringsPath = resolve('superapp/shell/android/app/src/main/res/values/strings.xml');
const APP_LABEL = 'APOIS Cliente';

if (!existsSync(resRoot)) throw new Error(`Recursos Android não encontrados: ${resRoot}`);

// Launcher determinístico, sem depender de PNG que pode ficar preto/branco no OEM.
// Um único A dourado, pequeno, perfeitamente centralizado e com ampla margem.
const drawableDir = join(resRoot, 'drawable');
const valuesDir = join(resRoot, 'values');
const legacyAnyDpi = join(resRoot, 'mipmap-anydpi');
const adaptiveDir = join(resRoot, 'mipmap-anydpi-v26');
for (const dir of [drawableDir, legacyAnyDpi, adaptiveDir]) mkdirSync(dir, { recursive: true });

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
const backgroundDrawable = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#050505" />
</shape>
`;
writeFileSync(join(drawableDir, 'apois_launcher_a.xml'), aVector, 'utf8');
writeFileSync(join(drawableDir, 'apois_launcher_a_monochrome.xml'), aVector.replace('#F6BE1C', '#FFFFFF'), 'utf8');
writeFileSync(join(drawableDir, 'apois_launcher_background.xml'), backgroundDrawable, 'utf8');

// O projeto Android criado pelo Capacitor já pode possuir ic_launcher_background.
// Evita uma segunda declaração da mesma cor e o erro Duplicate resources do AAPT2.
rmSync(join(valuesDir, 'apois_launcher_colors.xml'), { force: true });

const legacyXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@drawable/apois_launcher_background" />
    <item android:drawable="@drawable/apois_launcher_a" />
</layer-list>
`;
writeFileSync(join(legacyAnyDpi, 'ic_launcher.xml'), legacyXml, 'utf8');
writeFileSync(join(legacyAnyDpi, 'ic_launcher_round.xml'), legacyXml, 'utf8');

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/apois_launcher_background" />
    <foreground android:drawable="@drawable/apois_launcher_a" />
    <monochrome android:drawable="@drawable/apois_launcher_a_monochrome" />
</adaptive-icon>
`;
writeFileSync(join(adaptiveDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
writeFileSync(join(adaptiveDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

for (const density of ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi']) {
  const dir = join(resRoot, density);
  for (const file of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png', 'ic_launcher.webp', 'ic_launcher_round.webp', 'ic_launcher_foreground.webp']) {
    rmSync(join(dir, file), { force: true });
  }
}

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

console.log('[OK] Launcher APOIS Cliente: fundo preto + um único A dourado centralizado, normal/round/adaptive.');
