import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.cwd(), '.work/corridas/src/hooks/rides/use-active-ride.tsx');
const before = readFileSync(path, 'utf8');

if (before.includes('const POLLING_INTERVAL_MS = 3_000;')) {
  console.log('[OK] Corridas: polling ativo já está em 3s.');
  process.exit(0);
}

if (!before.includes('const POLLING_INTERVAL_MS = 12_000;')) {
  throw new Error('[FAIL] Corridas: constante POLLING_INTERVAL_MS esperada não encontrada');
}

const after = before.replace(
  'const POLLING_INTERVAL_MS = 12_000;',
  'const POLLING_INTERVAL_MS = 3_000;',
);

if (!after.includes('const POLLING_INTERVAL_MS = 3_000;')) {
  throw new Error('[FAIL] Corridas: polling ativo de 3s não foi aplicado');
}

writeFileSync(path, after, 'utf8');
console.log('[OK] Corridas: polling ativo reduzido de 12s para 3s.');
