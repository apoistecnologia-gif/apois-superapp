import './harden-superapp-android-security.mjs';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const legacySource = resolve('superapp/branding/apois-launcher.png');
const foregroundSource = resolve('superapp/branding/apois-launcher-foreground.png');
const resRoot = resolve('superapp/shell/android/app/src/main/res');
const manifestPath = resolve('superapp/shell/android/app/src/main/AndroidManifest.xml');
const stringsPath = resolve('superapp/shell/android/app/src/main/res/values/strings.xml');
const APP_LABEL = process.env.APP_LABEL?.trim() || 'APOIS';

if (!existsSync(resRoot)) throw new Error(`Recursos Android não encontrados: ${resRoot}`);

function assertPng(path, label) {
  if (!existsSync(path)) throw new Error(label + ': arquivo ausente: ' + path);
  const bytes = readFileSync(path);
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < pngSignature.length || pngSignature.some((value, index) => bytes[index] !== value)) {
    throw new Error(label + ': saída não é PNG válido: ' + path);
  }
}

function resizePng(source, size, output) {
  const result = spawnSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), source, '--out', output], { encoding: 'utf8' });
  if (!result.error && result.status === 0 && existsSync(output)) {
    assertPng(output, 'Launcher APOIS convertido');
    return;
  }
  // Fora do macOS, a fonte versionada já é PNG válido e pode ser copiada sem
  // mascarar JPEG/WebP como .png.
  assertPng(source, 'Fonte launcher APOIS');
  copyFileSync(source, output);
  assertPng(output, 'Launcher APOIS copiado');
}


for (const source of [legacySource, foregroundSource]) {
  if (!existsSync(source)) throw new Error(`Arte oficial APOIS não encontrada: ${source}`);
  assertPng(source, 'Arte nativa APOIS');
}

function removeStaleLauncherBitmaps(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (!/^ic_launcher(?:_round|_foreground|_background)?\.(?:png|webp|jpe?g)$/i.test(entry)) continue;
    rmSync(join(dir, entry), { force: true });
  }
}

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

  const legacyTmp = `/tmp/apois-client-launcher-${density.legacy}.png`;
  const foregroundTmp = `/tmp/apois-client-launcher-foreground-${density.foreground}.png`;
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

rmSync(join(drawableDir, 'apois_launcher_a.xml'), { force: true });
rmSync(join(drawableDir, 'apois_launcher_a_monochrome.xml'), { force: true });
rmSync(join(drawableDir, 'ic_launcher_monochrome.xml'), { force: true });
rmSync(join(drawableDir, 'ic_launcher_foreground.xml'), { force: true });

const backgroundDrawable = `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#050505" />
</shape>
`;
writeFileSync(join(drawableDir, 'apois_launcher_background.xml'), backgroundDrawable, 'utf8');

rmSync(join(legacyAnyDpi, 'ic_launcher.xml'), { force: true });
rmSync(join(legacyAnyDpi, 'ic_launcher_round.xml'), { force: true });

const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/apois_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
writeFileSync(join(adaptiveDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');

writeFileSync(join(adaptiveDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

const splashXml = `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@android:color/black" />
    <item android:gravity="center">
        <inset
            android:drawable="@mipmap/ic_launcher_foreground"
            android:insetLeft="64dp"
            android:insetTop="64dp"
            android:insetRight="64dp"
            android:insetBottom="64dp" />
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
if (!adaptiveInstalled.includes('@mipmap/ic_launcher_foreground')) throw new Error('Ícone adaptativo não usa o PNG oficial APOIS.');
if (!splashInstalled.includes('@mipmap/ic_launcher_foreground')) throw new Error('Splash não usa a arte oficial APOIS.');
if (existsSync(join(drawableDir, 'ic_launcher_foreground.xml'))) throw new Error('Foreground vetorial provisório ainda está presente.');
console.log(`[OK] Launcher ${APP_LABEL} usa arte oficial APOIS em legacy/adaptive e splash; foreground provisório removido.`);
