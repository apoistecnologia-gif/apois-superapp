// RV12: Admin visual amplifications of VIS-027, VIS-032 and VIS-034; no API changes.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
export const MARK="APOIS_CV12_ADMIN_VISUAL_AMPLIFICATIONS_V1";
function one(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[RV12 admin] "+label+" "+n);return s.replace(a,b)}
export function patchAdminOrders(s){
  if(s.includes("APOIS_CV12_ADMIN_ORDERS_V1")){
    for(const x of ["ordersLoadFailed","timelineLoadFailed","aria-label=\"Filtrar pedidos por status\""])if(!s.includes(x))throw Error("[RV12 admin] partial orders "+x);
    return s;
  }
  s=one(s,'  const [timelineLoading, setTimelineLoading] = useState(false);',
    '  const [timelineLoading, setTimelineLoading] = useState(false);\n  const [ordersLoadFailed,setOrdersLoadFailed] = useState(false); // APOIS_CV12_ADMIN_ORDERS_V1\n  const [timelineLoadFailed,setTimelineLoadFailed] = useState(false);',"admin states");
  s=one(s,'      setOrders((ordersRes.data ?? []) as Order[]);',
    '      setOrdersLoadFailed(false);\n      setOrders((ordersRes.data ?? []) as Order[]);',"orders query success");
  s=one(s,'      console.error("admin orders load failed", error);',
    '      setOrdersLoadFailed(true);\n      console.error("admin orders load failed", error);',"orders query error");
  s=one(s,'      setTimeline(entries);',
    '      setTimelineLoadFailed(false);\n      setTimeline(entries);',"timeline query success");
  s=one(s,'      console.error("admin order timeline load failed", error);',
    '      setTimelineLoadFailed(true);\n      console.error("admin order timeline load failed", error);',"timeline query error");
  s=one(s,'      setSelectedOrderId(null);\n      setTimeline([]);\n      return;',
    '      setSelectedOrderId(null);\n      setTimeline([]);\n      setTimelineLoadFailed(false);\n      return;',"clear timeline error when collapsed");
  s=one(s,'    setSelectedOrderId(order.id);\n    await loadTimeline(order);',
    '    setSelectedOrderId(order.id);\n    setTimelineLoadFailed(false);\n    setTimeline([]);\n    await loadTimeline(order);',"new order cannot show stale timeline");
  s=one(s,'      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">',
    '      {ordersLoadFailed ? <div role="alert" className="rounded-xl border border-amber-500/30 p-3 text-sm text-amber-200">Não foi possível atualizar os pedidos. Os dados exibidos, se houver, podem estar desatualizados. <button type="button" onClick={() => void load(true)} className="ml-2 min-h-11 rounded-lg border border-amber-500/40 px-3 font-bold">Tentar novamente</button></div> : null}\n      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">',
    "orders visible error");
  s=one(s,'      {filtered.length === 0 ? (\n        <EmptyState',
    '      {filtered.length === 0 && ordersLoadFailed ? null : filtered.length === 0 ? (\n        <EmptyState',
    "orders not false empty");
  s=one(s,'                        ) : timeline.length === 0 ? (',
    '                        ) : timelineLoadFailed ? (\n                          <div role="alert" className="space-y-2 py-4 text-sm text-amber-200">Não foi possível consultar a timeline deste pedido. <button type="button" className="min-h-11 rounded-lg border border-amber-500/40 px-3 font-bold" onClick={() => void loadTimeline(order)}>Tentar novamente</button></div>\n                        ) : timeline.length === 0 ? (',
    "timeline not false empty");
  for(const [key,label] of [["statusFilter","Filtrar pedidos por status"],["paymentFilter","Filtrar pedidos por pagamento"],["cityFilter","Filtrar pedidos por cidade"]]){
    const token="          <select\n            value={"+key+"}";
    s=one(s,token,"          <select\n            aria-label=\""+label+"\"\n            value={"+key+"}","admin filter "+key);
  }
  return s;
}
export function patchAdminCoverage(s){
  if(s.includes("APOIS_CV12_ADMIN_COVERAGE_FIELDS_V1")){if(!s.includes("aria-label={ariaLabel ?? placeholder}"))throw Error("[RV12] coverage partially annotated");return s}
  s=one(s,'  placeholder,\n  inputMode,\n  maxLength,',
    '  placeholder,\n  ariaLabel,\n  inputMode,\n  maxLength,',"coverage optional label");
  s=one(s,'  placeholder: string;\n  inputMode?:',
    '  placeholder: string;\n  ariaLabel?: string;\n  inputMode?:',"coverage helper type");
  s=one(s,'      placeholder={placeholder}\n      inputMode={inputMode}',
    '      placeholder={placeholder}\n      aria-label={ariaLabel ?? placeholder} // APOIS_CV12_ADMIN_COVERAGE_FIELDS_V1\n      inputMode={inputMode}',"accessible field name");
  for(const [find,add] of [
    ['placeholder="Raio km"','placeholder="Raio km"\n                          ariaLabel="Raio de entrega do cliente em quilômetros"'],
    ['placeholder="Ex.: 8 (vazio desativa)"','placeholder="Ex.: 8 (vazio desativa)"\n                          ariaLabel="Raio de busca do entregador em quilômetros; vazio desativa"'],
    ['placeholder="America/Sao_Paulo"','placeholder="America/Sao_Paulo"\n                      ariaLabel="Fuso horário da cidade"'],
  ])s=one(s,find,add,"coverage explicit label");
  s=one(s,'              placeholder=\'{"type":"Polygon","coordinates":[...]}\'',
    '              aria-label="GeoJSON da zona de entrega"\n              placeholder=\'{"type":"Polygon","coordinates":[...]}\'',
    "GeoJSON accessible name");
  return s;
}
export function patchAdminReviewFilters(s){
  if(s.includes("APOIS_CV12_ADMIN_REVIEW_FILTERS_V1"))return s;
  return one(s,'                onClick={() => setFilter(id as typeof filter)}',
    '                onClick={() => setFilter(id as typeof filter)}\n                aria-pressed={filter === id}\n                data-apois-cv12="APOIS_CV12_ADMIN_REVIEW_FILTERS_V1"',
    "review filter pressed");
}
export function patchAdminSettlementFilters(s){
  if(s.includes("APOIS_CV12_ADMIN_SETTLEMENT_FILTERS_V1"))return s;
  return one(s,'            onClick={() => setFilter(id)}',
    '            onClick={() => setFilter(id)}\n            aria-pressed={filter === id}\n            data-apois-cv12="APOIS_CV12_ADMIN_SETTLEMENT_FILTERS_V1"',
    "settlement filter pressed");
}
const specs=[
  ["src/components/AdminOrdersPanel.tsx",patchAdminOrders],
  ["src/components/AdminCoveragePanel.tsx",patchAdminCoverage],
  ["src/components/AdminReviewsPanel.tsx",patchAdminReviewFilters],
  ["src/components/AdminCourierSettlementsPanel.tsx",patchAdminSettlementFilters],
];
export function applyAdminVisual12(root=process.cwd()){
  const work=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
  const plans=specs.map(([rel,fn])=>{const path=resolve(work,rel),old=readFileSync(path,"utf8");return{path,rel,old,next:fn(old)}});
  for(const p of plans)if(p.old!==p.next)writeFileSync(p.path,p.next,"utf8");
  return plans.filter(p=>p.old!==p.next).map(p=>p.rel);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
  console.log("[OK] RV12 Admin visual",applyAdminVisual12().join(",")||"already applied");