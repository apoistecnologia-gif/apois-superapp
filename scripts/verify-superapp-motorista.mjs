import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed=false;
function check(path,markers,label){
  const full=resolve(path);
  if(!existsSync(full)){console.error('[FAIL] '+label+': arquivo ausente '+path);failed=true;return}
  const source=readFileSync(full,'utf8');
  const missing=markers.filter(m=>!source.includes(m));
  if(missing.length){console.error('[FAIL] '+label+': '+missing.join(' | '));failed=true}
  else console.log('[OK] '+label);
}
function forbid(path,markers,label){
  const full=resolve(path);
  if(!existsSync(full)){console.error('[FAIL] '+label+': arquivo ausente '+path);failed=true;return}
  const source=readFileSync(full,'utf8');
  const found=markers.filter(m=>source.toLowerCase().includes(m.toLowerCase()));
  if(found.length){console.error('[FAIL] '+label+': '+found.join(' | '));failed=true}
  else console.log('[OK] '+label);
}

check('superapp/partner-shell/dist/modules/motorista/index.html',['Aguardando pagamento do passageiro','Safe2Pay'],'bundle Motorista reconhece hold Safe2Pay');
check('.work/partner-motorista/src/integrations/supabase/client.ts',["storageKey: 'apois-superapp-motorista-auth-v1'"],'Motorista usa sessão isolada');
check('.work/partner-motorista/src/routes/motorista.assinatura.tsx',['Pagamento eletrônico temporariamente indisponível','Nenhum gateway de cobrança está ativo'],'Mensalidade não reativa gateway aposentado');
check('.work/partner-motorista/src/routes/motorista.app.tsx',['aguardando_pagamento','Safe2Pay'],'Motorista não inicia deslocamento antes do PIX confirmado');
forbid('superapp/partner-shell/dist/modules/motorista/index.html',['Conectar Mercado Pago','mercadopago-oauth-start','asaas-create-driver-subaccount'],'bundle Motorista não expõe provider aposentado');

const htmlPath=resolve('superapp/partner-shell/dist/modules/motorista/index.html');
if(existsSync(htmlPath)){
  const html=readFileSync(htmlPath,'utf8');
  if(/\b(?:src|href)=["']\/(?!\/)/.test(html)){console.error('[FAIL] Motorista contém asset absoluto incompatível com módulo aninhado');failed=true}
  else console.log('[OK] Motorista usa assets relativos');
}
process.exit(failed?1:0);
