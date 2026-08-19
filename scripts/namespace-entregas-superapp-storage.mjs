import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = resolve('.work/entregas/src');
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx']);

const replacements = new Map([
  ['apois_cart_owner_id', 'apois-superapp-entregas:cart-owner-id'],
  ['apois_checkout_owner_id', 'apois-superapp-entregas:checkout-owner-id'],
  ['apois_active_pix', 'apois-superapp-entregas:active-pix'],
  ['apois_checkout_attempt', 'apois-superapp-entregas:checkout-attempt'],
  ['apois_persisted_', 'apois-superapp-entregas:persisted:'],
  ['apois_cart', 'apois-superapp-entregas:cart'],
  ['apois_merchant', 'apois-superapp-entregas:merchant'],
  ['apois_selected_address_id', 'apois-superapp-entregas:selected-address-id'],
  ['apois_checkout_address_changed', 'apois-superapp-entregas:checkout-address-changed'],
  ['apois_auto_locate_new_address', 'apois-superapp-entregas:auto-locate-new-address'],
  ['apois_payment_method', 'apois-superapp-entregas:payment-method'],
  ['apois:customer:bound_user_id', 'apois-superapp-entregas:bound-user-id'],
]);

const dynamicBoundUserPattern = 'const boundUserKey = `apois:${product}:bound_user_id`;';
const dynamicBoundUserReplacement =
  'const boundUserKey = product === "customer" ? "apois-superapp-entregas:bound-user-id" : `apois:${product}:bound_user_id`;';

function filesUnder(path) {
  const output = [];
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) output.push(...filesUnder(full));
    else if (extensions.has(extname(entry))) output.push(full);
  }
  return output;
}

let changedFiles = 0;
let replacementsApplied = 0;
for (const file of filesUnder(root)) {
  const before = readFileSync(file, 'utf8');
  let after = before;

  if (after.includes(dynamicBoundUserPattern)) {
    after = after.replace(dynamicBoundUserPattern, dynamicBoundUserReplacement);
    replacementsApplied += 1;
  }

  for (const [legacy, scoped] of replacements) {
    if (!after.includes(legacy)) continue;
    const count = after.split(legacy).length - 1;
    after = after.split(legacy).join(scoped);
    replacementsApplied += count;
  }
  if (after !== before) {
    writeFileSync(file, after, 'utf8');
    changedFiles += 1;
  }
}

const required = [
  ['contexts/CartContext.tsx', 'apois-superapp-entregas:cart'],
  ['contexts/CartContext.tsx', 'apois-superapp-entregas:merchant'],
  ['contexts/CartContext.tsx', 'apois-superapp-entregas:bound-user-id'],
  ['components/AuthSessionIsolation.tsx', 'apois-superapp-entregas:bound-user-id'],
  ['components/AuthSessionIsolation.tsx', 'apois-superapp-entregas:checkout-owner-id'],
  ['components/AuthSessionIsolation.tsx', 'apois-superapp-entregas:active-pix'],
  ['components/AuthSessionIsolation.tsx', 'apois-superapp-entregas:checkout-attempt'],
  ['routes/inicio.tsx', 'apois-superapp-entregas:checkout-address-changed'],
  ['routes/enderecos/novo.tsx', 'apois-superapp-entregas:auto-locate-new-address'],
];
for (const [relative, marker] of required) {
  const source = readFileSync(join(root, relative), 'utf8');
  if (!source.includes(marker)) {
    console.error(`[FAIL] Entregas: storage esperado não foi isolado em ${relative}: ${marker}`);
    process.exit(1);
  }
}

const authIsolation = readFileSync(join(root, 'components/AuthSessionIsolation.tsx'), 'utf8');
if (!authIsolation.includes(dynamicBoundUserReplacement)) {
  console.error('[FAIL] Entregas: AuthSessionIsolation não usa a mesma chave bound-user do CartContext no Superapp');
  process.exit(1);
}

for (const file of filesUnder(root)) {
  const source = readFileSync(file, 'utf8');
  for (const legacy of replacements.keys()) {
    if (source.includes(legacy)) {
      console.error(`[FAIL] Entregas: chave de storage legada ainda presente em ${file}: ${legacy}`);
      process.exit(1);
    }
  }
}

console.log(`[OK] Entregas: ${replacementsApplied} referência(s) de storage isoladas em ${changedFiles} arquivo(s) da cópia .work.`);
