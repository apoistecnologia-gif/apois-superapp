import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/partner-shell/index.html');
let source = readFileSync(path, 'utf8');

// O shell já nasce com a tela visual aprovada. Este hardener não redesenha;
// apenas garante que os requisitos móveis/safe-area continuem presentes.
for (const marker of [
  'overflow-x:hidden;overflow-y:auto',
  'object-fit:contain',
  'max(env(safe-area-inset-top),18px)',
  'max(54px,env(safe-area-inset-bottom))',
  '@media(max-height:760px)',
  '@media(max-width:380px)',
  'min-height:58px',
  'min-height:100dvh',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell Parceiro: ajuste mobile ausente (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Shell Parceiro: tela aprovada preservada, responsiva e protegida por safe-area.');
