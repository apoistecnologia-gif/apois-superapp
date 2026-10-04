import './harden-superapp-shell-iconography.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
let source = readFileSync(path, 'utf8');

source = source
  .replace('body{min-height:100dvh;overflow-x:hidden}', 'body{min-height:100dvh;overflow-x:hidden;overflow-y:auto}')
  .replace('padding:max(env(safe-area-inset-top),20px) 18px max(env(safe-area-inset-bottom),24px);overflow:hidden;', 'padding:max(env(safe-area-inset-top),20px) 18px max(env(safe-area-inset-bottom),24px);overflow-x:hidden;overflow-y:auto;');

for (const marker of [
  '--red:#E51B23',
  '--red-dark:#C9141B',
  'background:linear-gradient(180deg,#fff 0%,#fff8f7 66%,#fff1f2 100%)',
  '<h2>Corridas</h2>',
  '<h2>Entregas</h2>',
  'data-module="corridas"',
  'data-module="entregas"',
  'O seu caminho,',
  'do seu jeito.',
  '@media(max-height:760px)',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell cliente: identidade vermelha ausente (${marker})`);
}
if (/🚘|🚗|🏍️|🛍|🛵|📦/.test(source)) {
  throw new Error('[FAIL] Shell Cliente: emoji de serviço não pode substituir a ilustração visual.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Shell cliente: seletor APOIS vermelho/branco, responsivo e com ilustrações próprias.');
