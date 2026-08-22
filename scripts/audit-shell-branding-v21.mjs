import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function check(path, required, forbidden, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Shell branding v21: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = required.filter((marker) => !source.includes(marker));
  const found = forbidden.filter((marker) => source.includes(marker));
  if (missing.length || found.length) {
    console.error(`[FAIL] ${label}: ausente=${missing.join(' | ') || 'nenhum'} proibido=${found.join(' | ') || 'nenhum'}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

check('scripts/harden-superapp-shell-mobile-ui.mjs', [
  "import './harden-superapp-shell-iconography.mjs';",
  '--teal:#f2b414;',
  'object-fit:contain;padding:6px',
  '.vehicle svg,.delivery svg',
], ['#15d5ca', '#1ee1d4', '#09b8b0'], 'Seletor Cliente usa preto/dourado e logo sem corte');

check('scripts/harden-superapp-shell-iconography.mjs', [
  "import './harden-superapp-shell-copy.mjs';",
  'carSvg', 'motoSvg', 'bagSvg', 'boxSvg',
  'Carro • Moto • Fretes • Guincho • Envios',
  '<strong>Apois, <span>vamos?</span></strong>',
], ['🚘', '🚗', '🏍️', '🛍', '🛵', '📦'], 'Seletor usa SVG determinístico, categorias completas e slogan oficial');

check('scripts/harden-partner-shell-mobile-ui.mjs', [
  'object-fit:contain;padding:8px',
  '@media(max-height:700px)',
], [], 'Seletor Parceiro mantém a mesma marca sem recorte em telas pequenas');

process.exit(failed ? 1 : 0);
