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

// A arte versionada é imutável durante o build. Normalizamos somente uma cópia
// temporária para evitar que Codemagic altere o checkout e torne o build
// dependente do encoder PNG usado em uma execução anterior.
const normalizedSource = '/tmp/apois-launcher-normalized.png';
const normalize = spawnSync(
  'sips',
  ['-s', 'format', 'png', '-z', '192', '192', source, '--out', normalizedSource],
  { encoding: 'utf8' },
);
if (normalize.error || normalize.status !== 0 || !existsSync(normalizedSource)) {
  throw new Error(
    `Falha ao normalizar launcher com sips: ${normalize.error?.message || normalize.stderr || normalize.stdout || 'erro desconhecido'}`,
  );
}

const densityDirs = [
  'mipmap-mdpi',
  'mipmap-hdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi',
];

for (const dirName of densityDirs) {
  const dir = join(resRoot, dirName);
  mkdirSync(dir, { recursive: true });
  copyFileSync(normalizedSource, join(dir, 'ic_launcher.png'));
  copyFileSync(normalizedSource, join(dir, 'ic_launcher_round.png'));
  copyFileSync(normalizedSource, join(dir, 'ic_launcher_foreground.png'));
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

console.log('[OK] Launcher APOIS Brasil normalizado sem alterar a arte versionada e instalado em todas as densidades.');
