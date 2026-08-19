import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = resolve('superapp/branding/apois-launcher.png');
const resRoot = resolve('superapp/shell/android/app/src/main/res');
const manifestPath = resolve('superapp/shell/android/app/src/main/AndroidManifest.xml');

if (!existsSync(source)) {
  throw new Error(`Arte oficial do launcher não encontrada: ${source}`);
}
if (!existsSync(resRoot)) {
  throw new Error(`Recursos Android não encontrados: ${resRoot}`);
}

function renderPng(target, size) {
  mkdirSync(resolve(target, '..'), { recursive: true });
  const result = spawnSync(
    'sips',
    ['-s', 'format', 'png', '-z', String(size), String(size), source, '--out', target],
    { encoding: 'utf8' },
  );
  if (result.error || result.status !== 0 || !existsSync(target)) {
    throw new Error(
      `Falha ao rasterizar launcher ${size}px com sips: ${result.error?.message || result.stderr || result.stdout || 'erro desconhecido'}`,
    );
  }
}

const densitySizes = {
  'mipmap-mdpi': { launcher: 48, foreground: 108 },
  'mipmap-hdpi': { launcher: 72, foreground: 162 },
  'mipmap-xhdpi': { launcher: 96, foreground: 216 },
  'mipmap-xxhdpi': { launcher: 144, foreground: 324 },
  'mipmap-xxxhdpi': { launcher: 192, foreground: 432 },
};

for (const [dirName, sizes] of Object.entries(densitySizes)) {
  const dir = join(resRoot, dirName);
  mkdirSync(dir, { recursive: true });
  renderPng(join(dir, 'ic_launcher.png'), sizes.launcher);
  renderPng(join(dir, 'ic_launcher_round.png'), sizes.launcher);
  renderPng(join(dir, 'ic_launcher_foreground.png'), sizes.foreground);
}

// Legacy launchers must resolve to the real raster artwork instead of the
// generic vector/fallback generated during cap add android.
const legacyAnyDpi = join(resRoot, 'mipmap-anydpi');
rmSync(join(legacyAnyDpi, 'ic_launcher.xml'), { force: true });
rmSync(join(legacyAnyDpi, 'ic_launcher_round.xml'), { force: true });

const adaptiveDir = join(resRoot, 'mipmap-anydpi-v26');
mkdirSync(adaptiveDir, { recursive: true });
const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
</adaptive-icon>
`;
writeFileSync(join(adaptiveDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
writeFileSync(join(adaptiveDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

const manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) {
  throw new Error('AndroidManifest não aponta para @mipmap/ic_launcher.');
}
if (!manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) {
  throw new Error('AndroidManifest não aponta para @mipmap/ic_launcher_round.');
}

console.log('[OK] Launcher APOIS Brasil rasterizado em PNG padrão por densidade e adaptive icon configurado.');
