// APOIS STAGING SAFETY CONTRACT. Offline only — never sends a Pix or touches prod.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const checkout=read('supabase/functions/apois-driver-membership-checkout-v2/index.ts');
const webhook=read('supabase/functions/apois-driver-membership-webhook-v2/index.ts');
const status=read('supabase/functions/apois-driver-membership-status-v2/index.ts');
const adapter=read('supabase/functions/_shared/apois-driver-membership-pix-v2.mjs');
const schema=read('supabase/corridas-forward-migrations/20261123_driver_9990_pix_STAGE_ONLY_NOT_APPLIED.sql');
const settlement=read('supabase/corridas-forward-migrations/20261123_driver_9990_entitlement_settlement_STAGE_ONLY_NOT_APPLIED.sql');

test('new checkout is hard-disabled until server config AND operator approval',()=>{
 assert.match(checkout,/APOIS_PIX_OPERATOR_APPROVED/);
 assert.match(checkout,/config=await readSettings\(admin\)/);
 assert.match(checkout,/const config=await readSettings\(admin\); \/\/ fails closed BEFORE any financial write/);
 assert.match(adapter,/enabled!==true\|\|settings\?\.operatorApproved!==true/);
 assert.ok(!checkout.includes('transaction_amount:99.9')); // only provider adapter
 assert.ok(!checkout.includes('req.json()')); // never trusts browser price or driverId
 assert.match(checkout,/admin\.auth\.getUser\(token\)/);
 assert.match(checkout,/\.eq\("auth_user_id",auth\.user\.id\)/);
 assert.match(checkout,/\.eq\("user_id",profile\.id\)/);
 assert.match(checkout,/driver\.approval_status!=="aprovado"/);
});
test('Asaas/MP Pix stays one open driver charge without split',()=>{
 assert.match(schema,/driver_membership_charges_one_open_per_driver/);
 assert.match(schema,/WHERE status IN \('pending','confirmed'\)/);
 assert.match(checkout,/another_checkout_in_progress/);
 assert.match(checkout,/multiple_open_charges_need_reconciliation/);
 assert.match(checkout,/pendingGeneration:!pixPayload/);
 assert.match(checkout,/recoverReservedPixForCharge/);
 assert.match(checkout,/provider_payment_id===\"reservation:\"\+c\.id/);
 assert.match(adapter,/externalReference/);
 assert.match(adapter,/asaas_duplicate_reference_requires_reconciliation/);
 assert.ok(!checkout.includes('application_fee'));
 assert.ok(!checkout.includes('split:'));
});
test('webhooks require independent auth and actual bank GET before settlement',()=>{
 assert.match(webhook,/authenticateAsaasWebhook\(req\.headers,secret\)/);
 assert.match(webhook,/authenticateMercadoPagoWebhook/);
 assert.match(webhook,/fetchVerifiedBankPaymentForCharge/);
 assert.match(webhook,/admin\.rpc\(/);
 assert.match(webhook,/apois_apply_verified_driver_membership_pix_v2/);
 assert.match(adapter,/bank_payment_not_confirmed/);
 assert.match(adapter,/payment_reversal_requires_review/);
 assert.match(adapter,/payment_not_pix/);
 assert.match(settlement,/GRANT EXECUTE ON FUNCTION public\.apois_apply_verified_driver_membership_pix_v2/);
 assert.match(settlement,/TO service_role/);
 assert.match(settlement,/FROM PUBLIC, anon, authenticated/);
});
test('refunds stay under manual review; renewal preserves paid time',()=>{
 assert.match(webhook,/status:"refund_review"/);
 assert.match(settlement,/GREATEST\(COALESCE\(m\.paid_through/);
 assert.match(settlement,/was_duplicate:=true/);
 assert.match(settlement,/m\.monthly_fee_cents IS DISTINCT FROM c\.amount_cents/);
 assert.match(settlement,/c\.amount_cents IS DISTINCT FROM _verified_amount_cents/);
});
test('status endpoint owner-scoped, not frontend-authoritative',()=>{
 assert.match(status,/admin\.auth\.getUser\(token\)/);
 assert.match(status,/\.eq\("auth_user_id",auth\.user\.id\)/);
 assert.match(status,/\.eq\("driver_id",driver\.id\)/);
 assert.match(status,/paidThrough>now/);
 assert.ok(!status.includes('.update('));
 assert.ok(!status.includes('.insert('));
});
