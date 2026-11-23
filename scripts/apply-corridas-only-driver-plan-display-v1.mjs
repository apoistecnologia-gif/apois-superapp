/**
 * APOIS_CORRIDAS_ONLY_MEMBERSHIP_9990_DISPLAY_V1
 * This is a DISPLAY preview of the official new offer. It creates no Pix:
 * backend must own final amount and has its gateway fail-closed until launch.
 * Only modifies generated .work copy, preserving source repo + histories.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const dir=resolve('.work/partner-motorista/src');
const constants=resolve(dir,'lib/payments/types.ts');
const page=resolve(dir,'routes/motorista.assinatura.tsx');
let types=readFileSync(constants,'utf8'),ui=readFileSync(page,'utf8');
const matches=[...types.matchAll(/export const APOIS_MONTHLY_FEE_BRL\\s*=\\s*([0-9]+(?:\\.[0-9]+)?);/g)];
if(matches.length!==1)throw Error('[FAIL] Driver plan constant changed; review before preparing 9990');
const old=matches[0][0];
if (![49.9,59.9,99.9].includes(Number(matches[0][1])))
 throw Error('[FAIL] Unexpected historical fee, refusing automatic rewrite');
if(!ui.includes('Pagamento eletrônico temporariamente indisponível')||
   !ui.includes('Nenhum gateway de cobrança está ativo'))throw Error('[FAIL] Missing fail-closed electronic payment screen');
types=types.replace(old,'// Display-only price; Pix amount must be validated by server.\nexport const APOIS_MONTHLY_FEE_BRL = 99.9;');
ui=ui.replace('Mensalidade do motorista</h1>','Plano Motorista APOIS — R$ 99,90/mês</h1>');
ui=ui.replace('Nenhum gateway de cobrança está ativo para a mensalidade neste aplicativo.',
'Plano Motorista APOIS: R$ 99,90 por mês. Nenhum gateway de cobrança está ativo para a mensalidade neste aplicativo.');
for(const deny of ['asaas-create-driver-membership','mercadopago-create-driver-membership','generateMembershipPix','pixPayload']) if(ui.includes(deny))throw Error('[FAIL] Unapproved gateway call in driver page: '+deny);
writeFileSync(constants,types,'utf8');
writeFileSync(page,'// APOIS_CORRIDAS_ONLY_MEMBERSHIP_9990_DISPLAY_V1\n'+ui,'utf8');
console.log('[OK] 9990 commercial plan preview, provider strictly disabled until server-authorized deployment.');
