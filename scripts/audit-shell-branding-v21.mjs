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
  "data-apois-reference-home-v4",
  "class=\"brand-lockup\"",
  "class=\"brand-mark\"",
  ".visual svg",
  "source.includes('#15d5ca') || source.includes('#1ee1d4') || source.includes('#09b8b0')",
], 'Seletor Cliente reconhece Home V4, protege marca sem corte e rejeita teal legado');

check('scripts/harden-superapp-shell-iconography.mjs', [
  "import './harden-superapp-shell-copy.mjs';",
  'carSvg', 'motoSvg', 'bagSvg', 'boxSvg',
  '/🚘|🚗|🏍️|🛍|🛵|📦/.test(source)',
  "data-apois-reference-home-v4",
  ".visual svg",
  '<strong>Apois, <span>vamos?</span></strong>',
], 'Seletor aceita a iconografia SVG nativa da Home V4 e preserva slogan final');

check('scripts/harden-partner-shell-mobile-ui.mjs', [
  'object-fit:contain;padding:8px',
  '@media(max-height:700px)',
], 'Seletor Parceiro mantém a mesma marca sem recorte em telas pequenas');

process.exit(failed ? 1 : 0);
