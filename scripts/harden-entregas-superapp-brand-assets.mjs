import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve('superapp/branding/apois-launcher.png');
if (!existsSync(source) || statSync(source).size < 1024) {
  throw new Error('[FAIL] Entregas: arte oficial APOIS ausente ou inválida');
}

for (const target of [
  '.work/entregas/public/apois-app-icon.png',
  '.work/entregas/public/favicon.png',
]) {
  const full = resolve(target);
  mkdirSync(dirname(full), { recursive: true });
  copyFileSync(source, full);
  if (!existsSync(full) || statSync(full).size !== statSync(source).size) {
    throw new Error(`[FAIL] Entregas: não foi possível instalar asset oficial em ${target}`);
  }
  console.log(`[OK] Entregas: asset oficial instalado em ${target}`);
}

console.log('[OK] Entregas: ícone e favicon do workspace usam a arte válida versionada no Superapp');
