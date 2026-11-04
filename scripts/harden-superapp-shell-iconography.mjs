import './harden-superapp-shell-copy.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
const source = readFileSync(path, 'utf8');

if (/🚘|🚗|🏍️|🛍|🛵|📦/.test(source)) {
  throw new Error('[FAIL] Shell Cliente: emojis não podem representar os serviços.');
}
for (const marker of [
  '<div class="visual">',
  'class="vehicle-photo"',
  'alt="Carro APOIS"',
  'alt="Moto de entregas APOIS"',
  '<h2>Corridas</h2>',
  '<h2>Entregas</h2>',
  'APOIS • VAMOS?',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell Cliente: ilustração/texto visual ausente (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Shell Cliente: serviços usam veículos reais adesivados APOIS e não emojis/desenhos.');
