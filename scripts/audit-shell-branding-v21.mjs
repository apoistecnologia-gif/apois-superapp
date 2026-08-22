import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function check(path, required, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Shell branding v21: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = required.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ausente=${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

check('scripts/harden-superapp-shell-mobile-ui.mjs', [
  "import './harden-superapp-shell-iconography.mjs';",
  ".replace('--teal:#15d5ca;', '--teal:#f2b414;')",
  "source.includes('#15d5ca') || source.includes('#1ee1d4') || source.includes('#09b8b0')",
  'object-fit:contain;padding:6px',
  '.vehicle svg,.delivery svg',
], 'Seletor Cliente transforma a paleta antiga em preto/dourado e protege logo sem corte');

check('scripts/harden-superapp-shell-iconography.mjs', [
  "import './harden-superapp-shell-copy.mjs';",
  'carSvg', 'motoSvg', 'bagSvg', 'boxSvg',
  '/🚘|🚗|🏍️|🛍|🛵|📦/.test(source)',
  'Carro • Moto • Fretes • Guincho • Envios',
  '<strong>Apois, <span>vamos?</span></strong>',
], 'Seletor substitui emojis por SVG determinístico e valida categorias/slogan finais');

check('scripts/harden-partner-shell-mobile-ui.mjs', [
  'object-fit:contain;padding:8px',
  '@media(max-height:700px)',
], 'Seletor Parceiro mantém a mesma marca sem recorte em telas pequenas');

process.exit(failed ? 1 : 0);
