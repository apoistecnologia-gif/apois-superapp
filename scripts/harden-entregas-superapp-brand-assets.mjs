import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const source = resolve('superapp/branding/apois-client-red-logo.b64');
if (!existsSync(source) || statSync(source).size < 1024) {
  throw new Error('[FAIL] Entregas: arte oficial APOIS ausente ou inválida');
}
const brandBytes = Buffer.from(readFileSync(source, 'utf8').trim(), 'base64');
if (
  brandBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
  brandBytes.length !== 23158 ||
  brandBytes.readUInt32BE(16) !== 128 ||
  brandBytes.readUInt32BE(20) !== 128
) {
  throw new Error('[FAIL] Entregas: base64 da marca APOIS não gerou o PNG oficial 128x128');
}

for (const target of [
  '.work/entregas/public/apois-app-icon.png',
  '.work/entregas/public/favicon.png',
  '.work/entregas/src/assets/apois-client-red-logo.png',
]) {
  const full = resolve(target);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, brandBytes);
  if (!existsSync(full) || statSync(full).size !== brandBytes.length) {
    throw new Error(`[FAIL] Entregas: não foi possível instalar asset oficial em ${target}`);
  }
  console.log(`[OK] Entregas: asset oficial instalado em ${target}`);
}

console.log('[OK] Entregas: ícone e favicon do workspace usam a arte válida versionada no Superapp');
