import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/partner-entregador');
const src=readFileSync(resolve(root,'src/components/CourierPanels.tsx'),'utf8');
const start=src.indexOf('export function CourierProfilePanel(');
const section=src.slice(start);
assert.ok(start>0,'CourierProfilePanel is missing');
for(const marker of [
 'data-apois-courier-new-membership-rate-v1',
 'Plano Entregador APOIS',
 'R$ 49,90',
 'Valor previsto para novas contratações',
 'Contratos anteriores mantêm suas condições',
 'A cobrança da mensalidade ainda não foi habilitada',
 'não confirma assinatura ativa e não gera pagamento',
 'onClick={onFinance}',
 'onClick={onLogout}',
 'APOIS_COURIER_PROFILE_EDIT_V1',
])assert.ok(section.includes(marker),'Courier subscription disclosure missing: '+marker);
assert.equal(section.split('data-apois-courier-new-membership-rate-v1').length-1,1,'Duplicate subscription disclosure');
assert.ok(section.indexOf('data-apois-courier-new-membership-rate-v1')<section.indexOf('onClick={onFinance}'),'Fee disclosure must appear before finance actions');
assert.ok(!section.includes('createCourierSubscription')&&!section.includes('checkoutSubscription'),'Do not activate unavailable courier subscription API');
console.log('[PASS] Courier 49.90 commercial disclosure does not activate billing, alter profile handlers or claim active subscription.');
