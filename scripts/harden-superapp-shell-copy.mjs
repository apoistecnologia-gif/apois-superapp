import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
let source = readFileSync(path, 'utf8');
source = source
  .replace('Carro • Moto • Fretes • Guincho', 'Carro • Moto • Fretes • Guincho • Envios')
  .replace('<strong>Apois, <span>vamos!</span></strong>', '<strong>Apois, <span>vamos?</span></strong>');

for (const marker of ['Carro • Moto • Fretes • Guincho • Envios', '<strong>Apois, <span>vamos?</span></strong>']) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell Cliente: texto oficial ausente (${marker})`);
}
writeFileSync(path, source, 'utf8');
console.log('[OK] Shell Cliente: categorias e slogan seguem a nomenclatura oficial APOIS.');
