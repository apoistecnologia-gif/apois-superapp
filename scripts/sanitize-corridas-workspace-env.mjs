import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve('.work/corridas/.env');
if (existsSync(envPath)) {
  const source = readFileSync(envPath, 'utf8');
  if (source.includes('zjphbuvcapwyuynadgdt')) {
    console.log('[INFO] Corridas: removendo .env legado do snapshot antes do build do Superapp');
  }
  rmSync(envPath, { force: true });
}

if (existsSync(envPath)) throw new Error('[FAIL] Corridas: .env legado permaneceu no workspace');
console.log('[OK] Corridas: build não pode herdar VITE_* do .env protegido legado');
