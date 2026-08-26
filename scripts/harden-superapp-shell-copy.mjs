import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
let source = readFileSync(path, 'utf8');
source = source
  .replace('Carro • Moto • Fretes • Guincho • Envios', 'Carro • Moto • Envios')
  .replace('Carro • Moto • Fretes • Guincho', 'Carro • Moto • Envios')
  .replace('<strong>Apois, <span>vamos!</span></strong>', '<strong>Apois, <span>vamos?</span></strong>');

for (const marker of ['Carro • Moto • Envios', '<strong>Apois, <span>vamos?</span></strong>']) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell Cliente: texto oficial ausente (${marker})`);
}
writeFileSync(path, source, 'utf8');
console.log('[OK] Shell Cliente: mostra somente categorias liberadas e o slogan oficial APOIS.');
