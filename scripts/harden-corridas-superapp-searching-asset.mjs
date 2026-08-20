import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/components/rides/active/SearchingDriverScreen.tsx');
let source = readFileSync(path, 'utf8');

const absolute = '<img src="/favicon.png" alt="" aria-hidden="true" className="h-14 w-14 object-contain" />';
const relative = '<img src="./favicon.png" alt="" aria-hidden="true" className="h-14 w-14 object-contain" />';

if (source.includes(absolute)) {
  source = source.replace(absolute, relative);
  writeFileSync(path, source, 'utf8');
  console.log('[OK] Corridas: logomarca da busca por motorista usa caminho relativo ao módulo do Superapp.');
} else if (source.includes(relative)) {
  console.log('[OK] Corridas: logomarca da busca por motorista já usa caminho relativo ao módulo.');
} else {
  throw new Error('Corridas: imagem central da tela Procurando motorista não foi encontrada no formato esperado.');
}
