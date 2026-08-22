import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function check(path, markers, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Order finish UI v19: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

check('scripts/harden-entregas-order-finish-mobile-ui.mjs', [
  "patch('src/routes/pedido/confirmado.tsx'",
  'min-h-dvh',
  'overflow-y-auto',
  'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
  "patch('src/routes/pedido/$orderId/avaliar.tsx'",
  'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
  'pt-[max(env(safe-area-inset-top),0.85rem)]',
  'pb-[max(env(safe-area-inset-bottom),1rem)]',
], 'Confirmação e avaliação do pedido ficam utilizáveis em telas baixas e com toque mínimo');

check('.apois/modules.json', [
  'node scripts/harden-entregas-order-finish-mobile-ui.mjs',
], 'Hardening das telas finais roda antes do build real de Entregas');

process.exit(failed ? 1 : 0);
