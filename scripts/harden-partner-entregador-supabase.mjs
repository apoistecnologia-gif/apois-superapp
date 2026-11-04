import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const workspace=process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path=resolve(root,workspace,'src/integrations/supabase/config.ts');
let source=readFileSync(path,'utf8');
source=source
  .replaceAll('https://sbvhdgyuuperszlsllji.supabase.co','https://ptgkwyyolrdgnqketkjj.supabase.co')
  .replaceAll('sb_publishable_tmNxPNALqBcWiEdD7_eWOw_mk0qRkJa','sb_publishable_DcfjTMboo1HX0O3w8Ptijg_quQbvVBY');
if(!source.includes('https://ptgkwyyolrdgnqketkjj.supabase.co')) throw new Error('[FAIL] Entregador: URL Supabase canônica não aplicada');
if(source.includes('sbvhdgyuuperszlsllji.supabase.co')) throw new Error('[FAIL] Entregador: URL Supabase antiga permaneceu');
writeFileSync(path,source,'utf8');
console.log('[OK] Entregador Parceiro: Supabase apontado para APOIS ENTREGAS - PRODUÇÃO ativo.');
