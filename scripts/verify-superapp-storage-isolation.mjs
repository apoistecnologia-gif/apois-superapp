import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const checks = [
  ['.work/entregas/src/contexts/CartContext.tsx', [
    'apois-superapp-entregas:cart',
    'apois-superapp-entregas:merchant',
    'apois-superapp-entregas:cart-owner-id',
    'apois-superapp-entregas:bound-user-id',
  ]],
  ['.work/entregas/src/components/AuthSessionIsolation.tsx', [
    'apois-superapp-entregas:bound-user-id',
    'apois-superapp-entregas:checkout-owner-id',
    'apois-superapp-entregas:active-pix',
    'apois-superapp-entregas:checkout-attempt',
    'apois-superapp-entregas:persisted:',
  ]],
  ['.work/entregas/src/routes/inicio.tsx', [
    'apois-superapp-entregas:checkout-address-changed',
  ]],
  ['.work/entregas/src/routes/enderecos/novo.tsx', [
    'apois-superapp-entregas:auto-locate-new-address',
  ]],
];

let failed = false;
for (const [path, markers] of checks) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] storage isolation: arquivo ausente ${path}`);
    failed = true;
    continue;
  }
  const source = readFileSync(full, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] storage isolation ${path}: ${missing.join(', ')}`);
    failed = true;
  } else {
    console.log(`[OK] storage isolation ${path}`);
  }
}

const auth = existsSync(resolve('.work/entregas/src/components/AuthSessionIsolation.tsx'))
  ? readFileSync(resolve('.work/entregas/src/components/AuthSessionIsolation.tsx'), 'utf8')
  : '';
const cart = existsSync(resolve('.work/entregas/src/contexts/CartContext.tsx'))
  ? readFileSync(resolve('.work/entregas/src/contexts/CartContext.tsx'), 'utf8')
  : '';
if (auth && cart) {
  const key = 'apois-superapp-entregas:bound-user-id';
  if (!auth.includes(key) || !cart.includes(key)) {
    console.error('[FAIL] AuthSessionIsolation e CartContext não compartilham a mesma chave de identidade do cliente');
    failed = true;
  } else {
    console.log('[OK] identidade do cliente usa namespace único entre Auth e carrinho');
  }
}

process.exit(failed ? 1 : 0);
