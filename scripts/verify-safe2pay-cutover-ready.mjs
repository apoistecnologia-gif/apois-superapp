import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const state=JSON.parse(readFileSync(resolve('docs/safe2pay-cutover-state.json'),'utf8'));
const blocks=[];
if(!['receiver','platform'].includes(state.feePayer)) blocks.push('SAFE2PAY_PIX_FEE_PAYER ainda não decidido');
for(const [name,p] of Object.entries(state.supabase??{})) if(p.status!=='ACTIVE') blocks.push('Supabase '+name+' está '+p.status);
for(const [name,c] of Object.entries(state.legacyProviderCutover??{})) if(c.completed!==c.required) blocks.push(name+': cutover legado '+c.completed+'/'+c.required);
for(const [name,applied] of Object.entries(state.migrations??{})) if(applied!==true) blocks.push('migrations '+name+' ainda não aplicadas');
for(const [name,deployed] of Object.entries(state.edgeFunctions??{})) if(deployed!==true) blocks.push('Edge Functions '+name+' ainda não implantadas');
for(const key of ['credentialsConfigured','webhookConfigured','receiversValidated','controlledPixTestPassed']) if(state.safe2pay?.[key]!==true) blocks.push('Safe2Pay '+key+' pendente');
if(state.activation?.providerEnabled!==true) blocks.push('SAFE2PAY_PROVIDER_ENABLED ainda desligado');
if(state.activation?.corridasElectronicPaymentsEnabled!==true) blocks.push('Corridas electronic payments ainda desligado');
if(state.activation?.entregasElectronicPaymentsEnabled!==true) blocks.push('Entregas electronic payments ainda desligado');

if(blocks.length){
  for(const block of blocks) console.error('[BLOCK] '+block);
  console.error('[FAIL] Safe2Pay cutover ainda não pode ser considerado pronto.');
  process.exit(1);
}
console.log('[OK] Safe2Pay cutover pronto e integralmente evidenciado.');
