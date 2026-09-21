import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const state=JSON.parse(readFileSync(resolve('docs/supabase-runtime-availability-20260921.json'),'utf8'));
let failed=false;
for(const [name,p] of Object.entries(state.projects??{})){
  if(p.status!=='ACTIVE'){
    console.error('[BLOCK] '+name+': Supabase '+p.projectRef+' está '+p.status);
    failed=true;
  }
}
if(state.restoreAttempt?.result==='BLOCKED'){
  console.error('[BLOCK] restore impedido: '+state.restoreAttempt.error);
  failed=true;
}
if(failed){
  console.error('[FAIL] runtime Supabase indisponível para cutover/deploy.');
  process.exit(1);
}
console.log('[OK] runtimes Supabase ativos para deploy controlado.');
