/**
 * APOIS_CORRIDAS_ONLY_MEMBERSHIP_9990_DISPLAY_V2
 *
 * Patch ONLY the disposable Motorista build, preserving pinned sources and
 * legacy contracts. No live Pix is generated or a gateway enabled here.
 * A new contract is advertised as R$ 99,90; an existing contracted driver
 * continues seeing the monthly_fee_cents actually stored by their RLS query.
 * Backend authority remains required before billing or operational release.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('.work/partner-motorista');
const pagePath = resolve(root, 'src/routes/motorista.assinatura.tsx');
const typesPath = resolve(root, 'src/lib/payments/types.ts');
const priceOld = 'const cents = membership ? Number(membership.monthly_fee_cents) : 5990;';
const priceNew = 'const cents = membership ? Number(membership.monthly_fee_cents) : 9990;';
const acceptedOld = '[4990, 5990].includes(cents)';
const acceptedNew = '[4990, 5990, 9990].includes(cents)';
const constantOld = 'export const APOIS_MONTHLY_FEE_BRL = 59.9;';
const constantNew = 'export const APOIS_MONTHLY_FEE_BRL = 99.9;';

function replaceOnce(text, before, after, label) {
  if (text.split(before).length !== 2) throw Error('[FAIL] 99.90: source contract drift: ' + label);
  return text.replace(before, after);
}

let ui = readFileSync(pagePath, 'utf8');
let types = readFileSync(typesPath, 'utf8');
if (!ui.includes('Pagamento eletrônico temporariamente indisponível') ||
    !ui.includes('Nenhum gateway de cobrança está ativo')) {
  throw Error('[FAIL] 99.90: Pix gateway must remain disabled until homologation');
}
for (const prohibited of [
  'asaas-create-driver-membership', 'mercadopago-create-driver-membership',
  'generateMembershipPix', 'pixPayload',
]) if (ui.includes(prohibited)) throw Error('[FAIL] 99.90: live checkout survived: ' + prohibited);

// Older source transform queries the actual contract under RLS and may still
// show R$ 49,90/R$ 59,90 to contracted drivers. Only an uncontracted driver's
// future offer is changed. Never replace this with formatCurrency(99.9).
ui = replaceOnce(ui, priceOld, priceNew, 'new-contract fallback');
ui = replaceOnce(ui, acceptedOld, acceptedNew, 'historical contract allowlist');
types = replaceOnce(types, constantOld, constantNew, 'commercial price constant');
ui = replaceOnce(ui, 'Mensalidade do motorista</h1>',
  'Plano Motorista APOIS</h1>', 'visible plan heading');
ui = replaceOnce(ui,
  'Nenhum gateway de cobrança está ativo para a mensalidade neste aplicativo.',
  'O novo Plano Motorista APOIS custa R$ 99,90 por mês. Nenhum gateway de cobrança está ativo para a mensalidade neste aplicativo.',
  'disabled gateway notice');
ui = ui.replace(
  'New driver has no membership and sees the 59.90 commercial offer.',
  'New driver has no membership and sees the proposed R$ 99,90 offer.'
);
if (!ui.includes('.from("driver_memberships")') ||
    !ui.includes('.eq("driver_id", data.id)') ||
    !ui.includes('contractMonthlyFee === null') ||
    !ui.includes(priceNew) || !ui.includes(acceptedNew)) {
  throw Error('[FAIL] 99.90: owner-scoped price and historical contract display lost');
}
writeFileSync(typesPath, types, 'utf8');
writeFileSync(pagePath,
  '// APOIS_CORRIDAS_ONLY_MEMBERSHIP_9990_DISPLAY_V2\n' + ui, 'utf8');
console.log('[OK] Motorista: R$99.90 for new plan; original 49.90/59.90 contracted amounts preserved; no live gateway.');
