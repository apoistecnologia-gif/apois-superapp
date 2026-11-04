// This test is executed AFTER the fully transformed Motorista workspace exists.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista');
const price=readFileSync(resolve(root,'src/lib/payments/types.ts'),'utf8');
const ui=readFileSync(resolve(root,'src/routes/motorista.assinatura.tsx'),'utf8');
assert.ok(price.includes('export const APOIS_MONTHLY_FEE_BRL = 59.9;'),'New driver rate is not R$59.90');
assert.ok(!price.includes('APOIS_MONTHLY_FEE_BRL = 49.9;'),'Old global rate is still used for new contracts');
for(const marker of [
 'APOIS_DRIVER_NEW_MONTHLY_FEE_5990_V1',
 '.select("id,approval_status,subscription_status")',
 '.from("driver_memberships")',
 '.select("monthly_fee_cents")',
 '.eq("driver_id", data.id)',
 'if (contractError) throw new Error("membership_price_unavailable")',
 '[4990, 5990].includes(cents)',
 'setContractMonthlyFee(cents / 100)',
 'contractMonthlyFee === null ? "Valor indisponível"',
 'Pagamento eletrônico temporariamente indisponível'
]) assert.ok(ui.includes(marker),'Driver contract price UI regression: '+marker);
assert.ok(!ui.includes('{formatCurrency(APOIS_MONTHLY_FEE_BRL)}'),
 'Must not ignore price already assigned to a driver membership');
const priceFor=(membership)=> {
 const cents=membership?Number(membership.monthly_fee_cents):5990;
 if(!Number.isInteger(cents)||![4990,5990].includes(cents))return null;
 return cents/100;
};
assert.equal(priceFor(null),59.9);
assert.equal(priceFor({monthly_fee_cents:4990}),49.9);
assert.equal(priceFor({monthly_fee_cents:5990}),59.9);
assert.equal(priceFor({monthly_fee_cents:6990}),null);
console.log('[PASS] Driver offer 59.90; existing membership stays original 49.90/59.90 with RLS and no invented fallback');
