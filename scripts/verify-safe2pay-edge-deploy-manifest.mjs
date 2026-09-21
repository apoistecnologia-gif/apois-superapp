import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest=JSON.parse(readFileSync(resolve('docs/safe2pay-edge-deploy-manifest.json'),'utf8'));
let failed=false;
const fail=(m)=>{failed=true;console.error('[FAIL] '+m)};
const expected={
  corridas:{
    projectRef:'vqtucstyduxrqjgyigfk',
    env:{SAFE2PAY_ONBOARDING_PRODUCT:'rides',SAFE2PAY_WEBHOOK_PRODUCT:'rides',SAFE2PAY_STATUS_PRODUCT:'rides'},
    functions:{
      'safe2pay-subaccount-onboarding':true,
      'safe2pay-subaccount-reconcile':true,
      'safe2pay-create-ride-pix':true,
      'safe2pay-payment-status':true,
      'safe2pay-webhook':false,
    },
  },
  entregas:{
    projectRef:'sbvhdgyuuperszlsllji',
    env:{SAFE2PAY_ONBOARDING_PRODUCT:'orders',SAFE2PAY_WEBHOOK_PRODUCT:'orders',SAFE2PAY_STATUS_PRODUCT:'orders'},
    functions:{
      'safe2pay-subaccount-onboarding':true,
      'safe2pay-subaccount-reconcile':true,
      'safe2pay-create-order-pix':true,
      'safe2pay-payment-status':true,
      'safe2pay-webhook':false,
    },
  },
};

for(const [product,contract] of Object.entries(expected)){
  const got=manifest.projects?.[product];
  if(!got){fail(product+': projeto ausente');continue;}
  if(got.projectRef!==contract.projectRef) fail(product+': projectRef incorreto');
  for(const [key,value] of Object.entries(contract.env)){
    if(got.env?.[key]!==value) fail(product+': env '+key+' incorreto');
  }
  const functions=new Map((got.functions??[]).map((x)=>[x.slug,x]));
  for(const [slug,verifyJwt] of Object.entries(contract.functions)){
    const item=functions.get(slug);
    if(!item){fail(product+': função ausente '+slug);continue;}
    if(item.verify_jwt!==verifyJwt) fail(product+': verify_jwt incorreto em '+slug);
    const source=resolve('supabase/functions',slug,'index.ts');
    if(!existsSync(source)) fail(product+': source ausente '+slug);
  }
}
if(manifest.policy!=='Explicit per-slug deployment only. Never deploy-all.') fail('política de deploy não é explicit-per-slug');
if(failed) process.exit(1);
console.log('[OK] Safe2Pay deploy manifest separa Corridas/Entregas e deixa somente webhook sem JWT.');
