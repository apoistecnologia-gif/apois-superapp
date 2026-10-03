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
  'data-apois-reference-home-v4',
  'class="brand-lockup"',
  'class="brand-mark"',
  '.visual svg',
  '--teal:#E51B23;',
], 'Seletor Cliente reconhece Home V4, protege marca e converte fallback antigo para vermelho APOIS');

check('scripts/harden-superapp-shell-iconography.mjs', [
  "import './harden-superapp-shell-copy.mjs';",
  'carSvg', 'motoSvg', 'bagSvg', 'boxSvg',
  '/🚘|🚗|🏍️|🛍|🛵|📦/.test(source)',
  'data-apois-reference-home-v4',
  '.visual svg',
  '<strong>Apois, <span>vamos?</span></strong>',
  'color:#E51B23',
], 'Seletor aceita iconografia SVG determinística com acento vermelho APOIS');

check('scripts/harden-partner-shell-mobile-ui.mjs', [
  'data-apois-partner-reference-v4',
  'class="partner-mark"',
  'class="partner-wordmark"',
  'object-fit:contain',
  '#F7F7F8',
  '#111111',
  '@media(max-height:780px)',
], 'Seletor Parceiro V4 usa símbolo + wordmark e base clara sem recorte');

check('superapp/shell/index.html', [
  '--bg:#F7F7F8',
  '--red:#E51B23',
  '--border:#E2E4E8',
  'background:#FFFFFF',
], 'Shell Cliente fonte usa a identidade clara oficial');

check('superapp/partner-shell/index.html', [
  'background:#F7F7F8',
  '--red:#E51B23',
  '--surface:#FFFFFF',
  '--border:#E2E4E8',
], 'Shell Parceiro fonte usa a mesma identidade clara oficial');

process.exit(failed ? 1 : 0);
