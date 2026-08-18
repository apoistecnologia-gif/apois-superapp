import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'superapp/shell/dist');
const required = [
  'index.html',
  'modules/corridas/index.html',
  'modules/entregas/index.html',
];

let failed = false;
for (const relative of required) {
  const path = resolve(dist, relative);
  if (!existsSync(path)) {
    console.error(`[FAIL] ausente: ${relative}`);
    failed = true;
  } else {
    console.log(`[OK] ${relative}`);
  }
}

if (!failed) {
  const shell = readFileSync(resolve(dist, 'index.html'), 'utf8');
  if (!shell.includes('./modules/corridas/index.html') || !shell.includes('./modules/entregas/index.html')) {
    console.error('[FAIL] shell não aponta para os dois módulos locais');
    failed = true;
  } else {
    console.log('[OK] shell aponta para Corridas e Entregas locais');
  }

  const corridas = readFileSync(resolve(dist, 'modules/corridas/index.html'), 'utf8');
  if (/\b(?:src|href)="\/assets\//.test(corridas)) {
    console.error('[FAIL] Corridas contém asset absoluto /assets/');
    failed = true;
  } else {
    console.log('[OK] Corridas usa assets compatíveis com pasta aninhada');
  }

  const entregas = readFileSync(resolve(dist, 'modules/entregas/index.html'), 'utf8');
  if (/\b(?:src|href)="\/assets\//.test(entregas)) {
    console.error('[FAIL] Entregas contém asset absoluto /assets/');
    failed = true;
  } else {
    console.log('[OK] Entregas usa assets compatíveis com pasta aninhada');
  }
}

process.exit(failed ? 1 : 0);
