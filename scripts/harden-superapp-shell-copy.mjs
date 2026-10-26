import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
const source = readFileSync(path, 'utf8');
for (const marker of ['O seu caminho,','do seu jeito.','Corridas','Entregas','APOIS • VAMOS?']) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell Cliente: texto oficial ausente (${marker})`);
}
writeFileSync(path, source, 'utf8');
console.log('[OK] Shell Cliente: copy oficial do novo seletor APOIS confirmada.');
