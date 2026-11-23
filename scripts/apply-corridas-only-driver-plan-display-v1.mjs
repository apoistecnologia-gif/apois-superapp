/**
 * APOIS_CORRIDAS_ONLY_MEMBERSHIP_9990_DISPLAY_V1
 * Only generated Moto subscription page. It does NOT create any payment.
 * The backend app_settings future price is the sole authoritative amount,
 * once the staged migration and the gateway are authorized.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const page=resolve('.work/partner-motorista/src/routes/motorista.assinatura.tsx');
let ui=readFileSync(page,'utf8');
if(!ui.includes('Pagamento eletrônico temporariamente indisponível')||
   !ui.includes('Nenhum gateway de cobrança está ativo'))throw Error('[FAIL] Subscription gateway must remain disabled');
const fare='formatCurrency(APOIS_MONTHLY_FEE_BRL)';
if(ui.split(fare).length!==2)throw Error('[FAIL] Unexpected generated subscription display price');
ui=ui.replace(fare,'formatCurrency(99.9)');
ui=ui.replace('Mensalidade do motorista</h1>','Plano Motorista APOIS — R$ 99,90/mês</h1>');
ui=ui.replace('Nenhum gateway de cobrança está ativo para a mensalidade neste aplicativo.',
'Plano Motorista APOIS: R$ 99,90 por mês. Nenhum gateway de cobrança está ativo para a mensalidade neste aplicativo.');
for(const deny of ['asaas-create-driver-membership','mercadopago-create-driver-membership','generateMembershipPix','pixPayload']){
 if(ui.includes(deny))throw Error('[FAIL] Unapproved gateway: '+deny);
}
writeFileSync(page,'// APOIS_CORRIDAS_ONLY_MEMBERSHIP_9990_DISPLAY_V1\n'+ui,'utf8');
console.log('[OK] APOIS Motorista shows R$99.90 commercial plan, no electronic collection enabled.');
