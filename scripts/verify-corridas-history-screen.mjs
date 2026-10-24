// Regressao para a aba "Suas Corridas" (antes era um placeholder branco).
// Somente leituras estaticas no workspace montado; nenhuma compilacao ou API.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const read=p=>readFileSync(resolve(workspace,p),'utf8');
const page=read('src/routes/_authenticated.corridas.tsx');
const auth=read('src/hooks/use-auth.tsx');
const types=read('src/integrations/supabase/types.ts');
const policy=readFileSync('supabase/corridas-forward-migrations/20260905070000_fix_passenger_identity_rls.sql','utf8');

for(const marker of [
  'APOIS_CLIENT_RIDE_HISTORY_V1',
  'createFileRoute("/_authenticated/corridas")',
  'useAuth()','profile?.id ?? null',
  'type RideHistoryRow = Pick<Database["public"]["Tables"]["rides"]["Row"]',
  'supabase.from("rides")',
  '.eq("passenger_id",passengerId)',
  '.order("created_at",{ascending:false})',
  '.range(start,start+PAGE_SIZE-1)',
  '.eq("status","finalizada")',
  '.in("status",["cancelada_passageiro","cancelada_motorista"])',
  'PAGE_SIZE=20',
  'status === "finalizada"',
  'cancelada_passageiro',
  'aria-label="Lista de corridas"',
  'aria-expanded={open}',
  'Ver detalhes',
  'Carregar mais corridas',
  'Não foi possível consultar suas corridas',
  'Nenhuma corrida encontrada',
  'Valor indisponível',
  'Date','setPageError',
]){
  if(marker==='Date'){
    assert.ok(page.includes('new Date(value)'),'Data da corrida sem parse seguro');
  }else if(marker==='status === "finalizada"'){
    assert.ok(page.includes('ride.status==="finalizada"'),'Concluidas nao foram classificadas');
  }else{
    assert.ok(page.includes(marker),'Historico nao contem '+marker);
  }
}
assert.ok(auth.includes('profile: AuthProfile | null;'),'Historico precisa do usuario de dominio autenticado');
assert.ok(types.includes('passenger_id: string'),'Tipos nao tem owner de corrida');
assert.ok(policy.includes('rides_select_passenger')&&policy.includes('u.id = rides.passenger_id')&&policy.includes('u.auth_user_id = auth.uid()'),'RLS nao limita corridas ao proprio passageiro');
assert.ok(!page.includes('user?.id ?? null'),'Query nao deve usar auth UID em vez de domain users ID');
for(const operation of [
  '.insert(','.update(','.upsert(','.delete(','.rpc(','functions.invoke(','supabase.auth.admin','service_role'
]){
  assert.ok(!page.includes(operation),'Historico incluiu operacao nao autorizada: '+operation);
}
assert.ok(!page.includes('return <div className="min-h-full bg-[#F7F7F8] p-6 text-[#111111]">Suas Corridas</div>'),'Placeholder permaneceu visivel');
console.log('[OK] APOIS Cliente Corridas: historico real, paginado por filtro, RLS de dominio e leitura exclusiva.');
