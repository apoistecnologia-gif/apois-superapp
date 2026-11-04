// APOIS Entregador: disclose the approved NEW-signup monthly fee only.
// Supabase has no courier subscription billing table or verified receipts.
// Keep dispatch, GPS, approval, payment and onboarding untouched.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador');
const path=resolve(root,'src/components/CourierPanels.tsx');
const before=readFileSync(path,'utf8');
const profileStart=before.indexOf('export function CourierProfilePanel(');
const marker='data-apois-courier-new-membership-rate-v1';
if(profileStart<0)throw Error('[FAIL] Courier membership disclosure: profile component missing');
const prefix=before.slice(0,profileStart);
let profile=before.slice(profileStart);
const anchor='        <button type="button" onClick={onFinance}';
if(!profile.includes(marker)){
 if(profile.split(anchor).length!==2)throw Error('[FAIL] Courier membership disclosure: profile finance anchor changed');
 const section=[
  '        {/* APOIS COURIER FEE: commercial information only, NOT an active subscription. */}',
  '        <section '+marker+' role="note" className="rounded-2xl border border-[#E6E8EC] bg-white p-4 shadow-sm">',
  '          <p className="text-xs font-bold uppercase tracking-wide text-[#596374]">Plano Entregador APOIS</p>',
  '          <p className="mt-2 text-2xl font-black text-[#C3142D]">R$ 49,90 <span className="text-sm font-semibold text-[#5F6978]">/ mês</span></p>',
  '          <p className="mt-2 text-xs leading-5 text-[#4B5563]">Valor previsto para novas contratações. Contratos anteriores mantêm suas condições.</p>',
  '          <p className="mt-2 text-xs leading-5 text-[#4B5563]">A cobrança da mensalidade ainda não foi habilitada. Esta informação não confirma assinatura ativa e não gera pagamento.</p>',
  '        </section>',
  '',
 ].join('\n');
 profile=profile.replace(anchor,section+anchor);
}
for(const expected of [
 marker,'R$ 49,90','novas contratações','Contratos anteriores','não confirma assinatura ativa','não gera pagamento',
 'onClick={onFinance}','onClick={onLogout}'
])if(!profile.includes(expected))throw Error('[FAIL] Courier fee disclosure missing '+expected);
const after=prefix+profile;
if(before!==after)writeFileSync(path,after,'utf8');
console.log('[OK] Entregador: 49.90 monthly fee disclosed for NEW contracts only; no subscription or payment activation.');
