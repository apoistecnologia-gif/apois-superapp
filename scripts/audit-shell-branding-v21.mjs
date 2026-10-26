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
  "'--red:#E51B23'",
  "'--red-dark:#C9141B'",
  "'<h2>Corridas</h2>'",
  "'<h2>Entregas</h2>'",
  "'min-height:126px'",
  "'aspect-ratio:1/1'",
], 'Seletor Cliente valida a nova identidade vermelho/branco, logo contida e mantém Corridas/Entregas');

check('superapp/shell/build.mjs', [
  "../branding/apois-client-red-logo.b64",
  "rgba(255,255,255,.96)",
  "#E51B23",
], 'Shell Cliente empacota a logo vermelha exclusiva e usa switcher claro');

check('scripts/harden-superapp-shell-iconography.mjs', [
  "import './harden-superapp-shell-copy.mjs';",
  '/🚘|🚗|🏍️|🛍|🛵|📦/.test(source)',
  "'<div class=\"visual\">'",
  "'class=\"vehicle-photo\"'",
  "'alt=\"Carro APOIS\"'",
  "'alt=\"Moto de entregas APOIS\"'",
], 'Seletor usa veículos reais adesivados APOIS em vez de desenhos/emojis');

check('superapp/partner-shell/index.html', [
  '--red:#E51B23',
  '--red-dark:#C9141B',
  'APOIS <em>Parceiro</em>',
  'Sou <em>Motorista</em>',
  'Sou <em>Entregador</em>',
  'background:#F7F7F8',
  '@media(max-height:760px)',
  '@media(max-width:380px)',
], 'Seletor Parceiro segue a tela aprovada vermelho/branco e permanece responsivo');

process.exit(failed ? 1 : 0);
