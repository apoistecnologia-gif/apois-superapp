import './harden-superapp-android-security.mjs';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
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

function runSips(args, label) {
  const result = spawnSync('sips', args, { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error(
      `Falha ao ${label}: ${result.error?.message || result.stderr || result.stdout || 'erro desconhecido'}`,
    );
  }
}

function renderPng(size, output, contentScale) {
  // O launcher anterior ocupava praticamente todo o canvas. Em launchers Android
  // com máscara adaptativa isso recortava o "A" nas bordas. A arte agora é
  // reduzida e centralizada dentro de uma zona segura, preservando o símbolo inteiro.
  const innerSize = Math.max(1, Math.round(size * contentScale));
  const tmp = `/tmp/apois-launcher-inner-${size}-${innerSize}.png`;

  runSips(
    ['-s', 'format', 'png', '-z', String(innerSize), String(innerSize), source, '--out', tmp],
    `redimensionar launcher para ${innerSize}x${innerSize}`,
  );
  runSips(
    ['-p', String(size), String(size), '--padColor', '050505', tmp, '--out', output],
    `centralizar launcher em canvas ${size}x${size}`,
  );

  if (!existsSync(output)) {
    throw new Error(`Launcher não foi gerado: ${output}`);
  }
  rmSync(tmp, { force: true });
}

// Android usa tamanhos físicos diferentes por densidade. Para o ícone legacy
// usamos 70% do canvas; no foreground adaptativo, 62%, porque a máscara do
// launcher pode recortar ainda mais as bordas dependendo do fabricante.
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

  const legacyTmp = `/tmp/apois-launcher-${density.legacy}.png`;
  const foregroundTmp = `/tmp/apois-launcher-foreground-${density.foreground}.png`;
  renderPng(density.legacy, legacyTmp, 0.70);
  renderPng(density.foreground, foregroundTmp, 0.62);

  copyFileSync(legacyTmp, join(dir, 'ic_launcher.png'));
  copyFileSync(legacyTmp, join(dir, 'ic_launcher_round.png'));
  copyFileSync(foregroundTmp, join(dir, 'ic_launcher_foreground.png'));
  rmSync(legacyTmp, { force: true });
  rmSync(foregroundTmp, { force: true });
}

// Legacy launchers devem apontar para o raster oficial, nunca para o fallback
// genérico criado por `cap add android`.
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
if (!manifest.includes('android:allowBackup="false"')) {
  throw new Error('AndroidManifest permite backup de dados do WebView/sessões.');
}
if (!manifest.includes('android:usesCleartextTraffic="false"')) {
  throw new Error('AndroidManifest não bloqueia tráfego HTTP cleartext.');
}

console.log('[OK] Launcher APOIS Cliente centralizado na zona segura Android e hardening validado.');
