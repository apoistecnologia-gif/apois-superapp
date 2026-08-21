import './harden-partner-mercadopago-callback.mjs';
import './harden-partner-android-security.mjs';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const source = resolve('superapp/branding/apois-launcher.png');
const resRoot = resolve('superapp/partner-shell/android/app/src/main/res');
const manifestPath = resolve('superapp/partner-shell/android/app/src/main/AndroidManifest.xml');

if (!existsSync(source)) throw new Error(`Arte oficial APOIS não encontrada: ${source}`);
if (!existsSync(resRoot)) throw new Error(`Recursos Android do APOIS Parceiro não encontrados: ${resRoot}`);

function renderPng(size, output) {
  const result = spawnSync('sips', ['-s', 'format', 'png', '-z', String(size), String(size), source, '--out', output], { encoding: 'utf8' });
  if (result.error || result.status !== 0 || !existsSync(output)) {
    throw new Error(`Falha ao gerar launcher ${size}x${size}: ${result.error?.message || result.stderr || result.stdout || 'erro desconhecido'}`);
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
  const legacyTmp = `/tmp/apois-partner-launcher-${density.legacy}.png`;
  const foregroundTmp = `/tmp/apois-partner-launcher-foreground-${density.foreground}.png`;
  renderPng(density.legacy, legacyTmp);
  renderPng(density.foreground, foregroundTmp);
  copyFileSync(legacyTmp, join(dir, 'ic_launcher.png'));
  copyFileSync(legacyTmp, join(dir, 'ic_launcher_round.png'));
  copyFileSync(foregroundTmp, join(dir, 'ic_launcher_foreground.png'));
}

const legacyAnyDpi = join(resRoot, 'mipmap-anydpi');
rmSync(join(legacyAnyDpi, 'ic_launcher.xml'), { force: true });
rmSync(join(legacyAnyDpi, 'ic_launcher_round.xml'), { force: true });

const adaptiveDir = join(resRoot, 'mipmap-anydpi-v26');
mkdirSync(adaptiveDir, { recursive: true });
const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background" />\n    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n</adaptive-icon>\n`;
writeFileSync(join(adaptiveDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
writeFileSync(join(adaptiveDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');

const manifest = readFileSync(manifestPath, 'utf8');
if (!manifest.includes('android:icon="@mipmap/ic_launcher"')) throw new Error('Manifest Parceiro não aponta para @mipmap/ic_launcher');
if (!manifest.includes('android:roundIcon="@mipmap/ic_launcher_round"')) throw new Error('Manifest Parceiro não aponta para @mipmap/ic_launcher_round');
if (!manifest.includes('android:allowBackup="false"')) throw new Error('Manifest Parceiro ainda permite backup de sessão.');
if (!manifest.includes('android:usesCleartextTraffic="false"')) throw new Error('Manifest Parceiro ainda permite tráfego HTTP cleartext.');
if (!manifest.includes('android:scheme="br.com.apois.parceiro"')) throw new Error('Manifest Parceiro não registra o scheme próprio.');
if (manifest.includes('android:scheme="br.com.apois.app"') && manifest.includes('android:pathPrefix="/mercadopago"')) throw new Error('Manifest Parceiro ainda registra callback Mercado Pago do app cliente.');

console.log('[OK] Ícone oficial APOIS aplicado ao APK Parceiro em todas as densidades, após hardening Android e isolamento OAuth.');
