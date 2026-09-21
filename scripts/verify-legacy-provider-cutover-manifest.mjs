import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const snapshot=JSON.parse(readFileSync(resolve('docs/provider-runtime-observed-20260921.json'),'utf8'));
const manifest=JSON.parse(readFileSync(resolve('docs/legacy-provider-failclosed-deploy-manifest.json'),'utf8'));
let failed=false;
const fail=(m)=>{failed=true;console.error('[FAIL] '+m)};
const ok=(m)=>console.log('[OK] '+m);

for(const project of ['corridas','entregas']){
  const rows=snapshot.projects?.[project]??[];
  const blockers=rows.filter((r)=>r.legacyRuntimeBlocker===true && r.status==='ACTIVE');
  const deployRows=manifest.projects?.[project]??[];
  if(deployRows.length!==blockers.length) fail(project+': manifest não cobre todos os blockers ativos');
  const byName=new Map(deployRows.map((r)=>[r.function,r]));
  for(const row of blockers){
    const item=byName.get(row.function);
    if(!item){fail(project+': blocker sem deploy item: '+row.function);continue;}
    if(item.verify_jwt!==row.verify_jwt) fail(project+': verify_jwt drift em '+row.function);
    const source=resolve('supabase/functions',row.function,'index.ts');
    if(!existsSync(source)){fail(project+': stub ausente: '+row.function);continue;}
    const code=readFileSync(source,'utf8');
    if(!code.includes('retiredProvider')||!code.includes('provider_retired')) fail(project+': stub não está fail-closed: '+row.function);
  }
  if(blockers.length) console.error('[BLOCK] '+project+': '+blockers.length+' runtimes legados ainda precisam receber o stub 410');
  else ok(project+': nenhum runtime legado ativo');
}
if(failed) process.exit(1);
console.log('[OK] Manifest cobre os runtimes legados; release continua bloqueado até o cutover ser observado no Supabase.');
