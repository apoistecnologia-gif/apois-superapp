// RV-16 — estritamente comunicação e acessibilidade sobre .work/entregas.
// Nenhuma consulta, fórmula, RPC, situação de pagamento ou critério de despacho é alterado.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const MARK = "APOIS_CV16_SCOPE_AND_LOCATION_COMMUNICATION_V1";
function one(src,from,to,where) {
  const n=src.split(from).length-1;
  if(n!==1)throw Error("[RV16] "+where+" anchor count="+n);
  return src.replace(from,to);
}
function verify(src,checks,where) {
  for(const check of checks)if(!src.includes(check))throw Error("[RV16] incomplete "+where+": "+check);
  return src;
}
export function patchMerchantSettlements(src) {
  const checks=[MARK,'label="A pagar aos entregadores"','Até 200 fechamentos mais recentes',
    'aria-pressed={filter === id}','break-all text-sm font-bold',
    'merchant_mark_courier_settlement_paid','navigator.clipboard.writeText(account.key)',
    'const pendingTotal = useMemo('];
  if(src.includes(MARK))return verify(src,checks,"merchant settlements");
  verify(src,['label="A receber (aberto)"','awaiting_payment: "A receber"',
    '.limit(200)','const pendingTotal = useMemo(',
    'navigator.clipboard.writeText(account.key)','merchant_mark_courier_settlement_paid'],
    "merchant pinned");
  let s=one(src,'awaiting_payment: "A receber"','awaiting_payment: "A pagar ao entregador"',
    "merchant financial perspective on status");
  s=one(s,'label="A receber (aberto)"','label="A pagar aos entregadores"',
    "merchant summary perspective");
  s=one(s,'      <div className="flex flex-wrap gap-2" aria-label="Filtros de repasse">',
    '      {/* '+MARK+' */}\n'+
    '      <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-300" role="note">Até 200 fechamentos mais recentes são carregados. Valores e filtros consideram somente essa lista; pendências mais antigas podem não aparecer aqui.</p>\n'+
    '      <div className="flex flex-wrap gap-2" aria-label="Filtros de repasse">',
    "merchant scope disclosure");
  s=one(s,'            onClick={() => setFilter(id)}',
    '            onClick={() => setFilter(id)}\n            aria-pressed={filter === id}',
    "merchant accessible selected filter");
  s=one(s,'className="mt-1 truncate text-sm font-bold"',
    'className="mt-1 break-all text-sm font-bold"',
    "Pix key full readable");
  s=one(s,'title="Nenhum repasse encontrado"',
    'title="Nenhum repasse neste recorte"',
    "scoped empty state");
  return verify(s,checks,"merchant updated");
}
export function patchAdminSettlements(src) {
  const checks=[MARK,'Até 300 fechamentos mais recentes',
    'aria-pressed={filter === id}',"admin_resolve_courier_settlement_dispute"];
  if(src.includes(MARK))return verify(src,checks,"admin settlements");
  verify(src,['.limit(300)','aria-pressed={filter === id}',
    'admin_resolve_courier_settlement_dispute'],'admin settlements RV12');
  let s=one(src,'      <div className="flex flex-wrap gap-2" aria-label="Filtros de repasse">',
    '      {/* '+MARK+' */}\n'+
    '      <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-300" role="note">Até 300 fechamentos mais recentes são carregados. Contadores e filtros consideram apenas essa lista; repasses antigos podem ficar fora da consulta atual.</p>\n'+
    '      <div className="flex flex-wrap gap-2" aria-label="Filtros de repasse">',
    "admin scope disclosure");
  s=one(s,'<EmptyState title="Nenhum repasse encontrado" description="Ajuste os filtros acima." />',
    '<EmptyState title="Nenhum repasse neste recorte" description="Ajuste os filtros. Registros antigos podem não estar entre os 300 carregados." />',
    "admin empty scope");
  return verify(s,checks,"admin updated");
}
export function patchAdminReviews(src) {
  const checks=[MARK,'Até 500 avaliações mais recentes',
    'aria-pressed={filter === id}','average(reviews.map('];
  if(src.includes(MARK))return verify(src,checks,"reviews");
  verify(src,['.limit(500)','aria-pressed={filter === id}','average(reviews.map('],
    "reviews RV12");
  let s=one(src,'      <section className="rounded-3xl border border-zinc-900 bg-zinc-950 p-4">',
    '      {/* '+MARK+' */}\n'+
    '      <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-300" role="note">Até 500 avaliações mais recentes são carregadas. As médias, contagens, a busca e os filtros consideram apenas os registros carregados, não necessariamente todas as avaliações da plataforma.</p>\n'+
    '      <section className="rounded-3xl border border-zinc-900 bg-zinc-950 p-4">',
    "review metrics scope disclosure");
  s=one(s,'title="Nenhuma avaliação encontrada"',
    'title="Nenhuma avaliação neste recorte"',
    "review empty message");
  s=one(s,'description="Ajuste os filtros ou aguarde novos pedidos avaliados."',
    'description="Ajuste a busca e os filtros. Avaliações anteriores às 500 carregadas podem não aparecer."',
    "review empty help");
  return verify(s,checks,"reviews updated");
}
export function patchRealtimeOperations(src) {
  const checks=[MARK,'até 300 entregas ativas mais recentemente atualizadas',
    'Não é aplicado critério de recência às coordenadas',
    'Última posição registrada: ','Diferença entre online e posições exibidas',
    'dateTime(location.recorded_at)','supabase.removeChannel(channel)'];
  if(src.includes(MARK))return verify(src,checks,"realtime");
  verify(src,['.limit(300)','onlineLocations.map((location) =>',
    'Sem posição recente','title={profile?.full_name ?? "Entregador online"}',
    'supabase.removeChannel(channel)'],"realtime pinned");
  let s=one(src,
    '            Atualização por Supabase Realtime, limitada a administradores autorizados.',
    '            Atualização por Supabase Realtime, limitada a administradores autorizados.\n'+
    '            {/* '+MARK+' */}',
    "realtime marker");
  s=one(s,'      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">',
    '      <p className="rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm leading-relaxed text-zinc-300" role="note">Indicadores de pedidos, valores e lista representam até 300 entregas ativas mais recentemente atualizadas. Esse recorte pode omitir operações mais antigas.</p>\n'+
    '      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">',
    "active jobs sample scope");
  s=one(s,'                 Somente entregadores online com localização válida.',
    '                 Somente entregadores online com coordenadas registradas. Não é aplicado critério de recência às coordenadas.',
    "map recency warning");
  s=one(s,'title={profile?.full_name ?? "Entregador online"}',
    'title={(profile?.full_name ?? "Entregador online") + " · Última posição registrada: " + dateTime(location.recorded_at)}',
    "marker date title");
  s=one(s,'aria-label={profile?.full_name ?? "Entregador online"}',
    'aria-label={(profile?.full_name ?? "Entregador online") + " · Última posição registrada: " + dateTime(location.recorded_at)}',
    "marker date aria-label");
  s=one(s,'<CircleAlert className="h-3 w-3" /> Sem posição recente',
    '<CircleAlert className="h-3 w-3" /> Diferença entre online e posições exibidas',
    "metric cannot claim recency");
  s=one(s,'          <div className="grid grid-cols-2 gap-3 p-4">',
    '          <p className="px-4 pt-3 text-sm leading-relaxed text-zinc-300" role="note">Posições exibidas podem ser antigas. A diferença numérica abaixo não considera a data da localização nem possíveis registros repetidos. Verifique a data em cada marcador antes de interpretar a localização.</p>\n'+
    '          <div className="grid grid-cols-2 gap-3 p-4">',
    "map explicit caveat");
  return verify(s,checks,"realtime updated");
}
export function applyVisual16(root=process.cwd()) {
  const dir=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
  const specs=[
    ["src/components/MerchantCourierSettlementsPanel.tsx",patchMerchantSettlements],
    ["src/components/AdminCourierSettlementsPanel.tsx",patchAdminSettlements],
    ["src/components/AdminReviewsPanel.tsx",patchAdminReviews],
    ["src/components/AdminRealtimeOperationsPanel.tsx",patchRealtimeOperations],
  ];
  // All four anchors must match before any modification; hard-fail on drift.
  const plans=specs.map(([rel,patch])=>{
    const path=resolve(dir,rel),before=readFileSync(path,"utf8"),after=patch(before);
    if(patch(after)!==after)throw Error("[RV16] non-idempotent "+rel);
    return {rel,path,before,after};
  });
  for(const p of plans)if(p.before!==p.after)writeFileSync(p.path,p.after,"utf8");
  return plans.map(p=>({file:p.rel,changed:p.before!==p.after}));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
  console.log("[OK] RV16 scope communication",JSON.stringify(applyVisual16()));
