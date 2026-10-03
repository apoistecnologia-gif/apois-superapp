import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.env.APOIS_SHELL_HTML_PATH?.trim() || 'superapp/shell/index.html');
let source = readFileSync(path, 'utf8');

source = source
  .replace('Carro • Moto • Fretes • Guincho • Envios', 'Carro • Moto • Envios')
  .replace('Carro • Moto • Fretes • Guincho', 'Carro • Moto • Envios')
  .replace('<strong>Apois, <span>vamos!</span></strong>', '<strong>Apois, <span>vamos?</span></strong>');

const isReferenceV4 = source.includes('data-apois-reference-home-v4="true"');
const hasAllowedCorridasCopy = isReferenceV4
  ? (
      /Carro[^<]*moto[^<]*envios/i.test(source) &&
      !/Fretes|Guincho/i.test(source.match(/<article class="service corridas">[\s\S]*?<\/article>/)?.[0] ?? '')
    )
  : source.includes('Carro • Moto • Envios');

if (!hasAllowedCorridasCopy) {
  throw new Error('[FAIL] Shell Cliente: categorias liberadas de Corridas não confirmadas');
}
if (!source.includes('<strong>Apois, <span>vamos?</span></strong>')) {
  throw new Error('[FAIL] Shell Cliente: slogan oficial ausente');
}

writeFileSync(path, source, 'utf8');
console.log(`[OK] Shell Cliente: mostra somente categorias liberadas e o slogan oficial APOIS (${path}).`);
