// Runs against the GENERATED Motorista source, never on protected submodules.
// UI flag defaults OFF. Backend must separately approve collection and verify Pix.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const path=resolve('.work/partner-motorista/src/routes/motorista.assinatura.tsx');
const src=readFileSync(path,'utf8');
for(const s of [
 'APOIS_DRIVER_PIX_V2_UI_STAGED',
 "VITE_APOIS_MEMBERSHIP_PIX_V2_UI === 'true'",
 'APOIS_PIX_V2_UI_ENABLED ? <DriverMembershipPixV2 />',
 'Pagamento eletrônico temporariamente indisponível',
 'apois-driver-membership-status-v2',
 'apois-driver-membership-checkout-v2',
 'method:"GET"',
 'result.data.amountCents!==9990',
 'data.pixEnabled',
 'data.approved',
 'data.membership.contractualFeeCents!==9990',
 'operationalByVerifiedMembership',
 'A liberação para receber novas corridas depende de confirmação no backend.',
])assert.ok(src.includes(s),'[FAIL] Missing staged Pix contract: '+s);
for(const forbidden of [
 'asaas-create-driver-membership',
 'mercadopago-create-driver-membership',
 'SUPABASE_SERVICE_ROLE_KEY',
 'MERCADOPAGO_ACCESS_TOKEN',
 'ASAAS_API_KEY',
])assert.ok(!src.includes(forbidden),'[FAIL] Legacy or privileged access leaked: '+forbidden);
assert.equal(src.split('APOIS_DRIVER_PIX_V2_UI_STAGED').length-1,1,'[FAIL] duplicate Pix UI');
console.log('[OK] Motorista Pix V2: stage-only disabled default, backend-authenticated price/status, no legacy provider or client credentials');
