import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";
import {
  MARK,patchMerchantSettlements,patchAdminSettlements,patchAdminReviews,patchRealtimeOperations
} from "../fix-entregas-finance-scope-visual16-v1.mjs";

const root=resolve(import.meta.dirname,"../..");
const workspace=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const get=rel=>readFileSync(resolve(workspace,rel),"utf8");
const readRepo=rel=>readFileSync(resolve(root,rel),"utf8");
const named={
  merchant:["src/components/MerchantCourierSettlementsPanel.tsx",patchMerchantSettlements],
  admin:["src/components/AdminCourierSettlementsPanel.tsx",patchAdminSettlements],
  reviews:["src/components/AdminReviewsPanel.tsx",patchAdminReviews],
  realtime:["src/components/AdminRealtimeOperationsPanel.tsx",patchRealtimeOperations],
};
const all=()=>Object.fromEntries(Object.entries(named).map(([k,[f]])=>[k,get(f)]));
const occurrences=(s,v)=>s.split(v).length-1;

test("RV16: patches applied, idempotent, and no source-lock or backend modifications",()=>{
  for(const [key,[path,patch]] of Object.entries(named)){
    const src=get(path);
    assert.ok(src.includes(MARK),key+" marker missing");
    assert.equal(patch(src),src,key+" must be idempotent");
  }
  const lock=JSON.parse(readRepo(".apois/source-lock.json"));
  assert.equal(lock.sources.entregas.commit,"2f4606e0fb52dffb49f2e6aebbe921ce687ab625");
  for(const builder of ["scripts/build-merchant-panel.mjs","scripts/build-isolated-module.mjs"]){
    const code=readRepo(builder);
    assert.ok(code.includes("fix-entregas-finance-scope-visual16-v1.mjs"));
    assert.ok(code.includes("test-entregas-finance-scope-visual16-v1.test.mjs"));
    assert.ok(code.indexOf("fix-entregas-admin-visual12-v1.mjs") < code.indexOf("fix-entregas-finance-scope-visual16-v1.mjs"));
  }
});

test("CV-055 / VIS-056: pending obligations remain BRL 50, not money received",()=>{
  const merchant=all().merchant;
  assert.ok(merchant.includes('label="A pagar aos entregadores"'));
  assert.ok(merchant.includes('awaiting_payment: "A pagar ao entregador"'));
  assert.ok(!merchant.includes('label="A receber (aberto)"'));
  const expression=merchant.match(/const pendingTotal = useMemo\([\s\S]*?\[settlements\],\s*\);/);
  assert.ok(expression,"original sum formula was not found");
  const calculate=new Function("settlements","useMemo",expression[0]+"\nreturn pendingTotal;");
  const fixture=[
    {effective_status:"awaiting_payment",total_amount:35},
    {effective_status:"overdue",total_amount:15},
    {effective_status:"confirmed",total_amount:90}
  ];
  assert.equal(calculate(fixture,fn=>fn()),50,"pending formula must remain 35+15");
  assert.ok(merchant.includes("Pix é feito por você, fora do app"));
  assert.ok(merchant.includes("merchant_mark_courier_settlement_paid"));
});

test("CV-056 / VIS-057: all four views disclose limited arrays, not global totals",()=>{
  const {merchant,admin,reviews,realtime}=all();
  for(const [s,cap,subject] of [
    [merchant,200,"fechamentos"],[admin,300,"fechamentos"],
    [reviews,500,"avaliações"],[realtime,300,"entregas ativas"]
  ]){
    assert.ok(s.includes(".limit("+cap+")"),subject+" cap changed");
    assert.ok(s.includes("Até "+cap),subject+" limit note missing");
    assert.ok(s.includes('role="note"'),subject+" note not exposed");
  }
  assert.ok(reviews.includes("médias, contagens, a busca e os filtros consideram apenas"));
  assert.ok(admin.includes('title="Nenhum repasse neste recorte"'));
  assert.ok(reviews.includes('title="Nenhuma avaliação neste recorte"'));
  assert.ok(realtime.includes("Resumo financeiro das entregas ativas"));
  assert.ok(reviews.includes("average(reviews.map("));
  // A 200-item slice can miss an older overdue item; the note must not imply exhaustive coverage.
  const sample=[...Array.from({length:200},(_,n)=>({id:n,status:"confirmed"})),{id:200,status:"overdue"}];
  assert.equal(sample.slice(0,200).filter(x=>x.status==="overdue").length,0);
  assert.equal(sample.filter(x=>x.status==="overdue").length,1);
});

test("CV-057 / VIS-058: old recorded position stays plotted but is not labeled recent",()=>{
  const src=all().realtime;
  assert.ok(src.includes('Não é aplicado critério de recência às coordenadas'));
  assert.ok(src.includes('dateTime(location.recorded_at)'));
  assert.ok(src.includes("Diferença entre online e posições exibidas"));
  assert.ok(!src.includes("Sem posição recente"));
  const matched=src.match(/const onlineLocations = useMemo\([\s\S]*?\[locations, onlineIds\],\s*\);/);
  assert.ok(matched,"original current-location predicate missing");
  const derive=new Function("locations","onlineIds","useMemo",matched[0]+"\nreturn onlineLocations;");
  const oldLocation={courier_id:"courier-fixture",latitude:-8.04,longitude:-34.87,recorded_at:"2020-01-01T10:00:00Z"};
  const valid=derive([oldLocation],new Set(["courier-fixture"]),fn=>fn());
  assert.equal(valid.length,1,"preserve historic map membership; recency contract remains pending");
  assert.ok(src.includes('title={(profile?.full_name ?? "Entregador online")'));
  assert.ok(src.includes("supabase.removeChannel(channel)"));
});

test("VIS-034 / VIS-039: filter state and readable full Pix with copy preserved",()=>{
  const {merchant,admin,reviews}=all();
  for(const s of [merchant,admin,reviews])assert.ok(s.includes("aria-pressed={filter === id}"));
  assert.ok(merchant.includes('className="mt-1 break-all text-sm font-bold"'));
  assert.ok(merchant.includes("navigator.clipboard.writeText(account.key)"));
  assert.ok(merchant.includes('onClick={() => void handleCopyPix(settlement.courier_id)}'));
  assert.ok(admin.includes('admin_resolve_courier_settlement_dispute'));
  assert.ok(reviews.includes('setQuery(event.target.value)'));
});

test("RV16 scope: original payment, refund, map and query contracts unchanged",()=>{
  const {merchant,admin,reviews,realtime}=all();
  for(const key of ["close_courier_settlements","merchant_mark_courier_settlement_paid",
    'rpc("merchant_mark_courier_settlement_paid"','setPixKeys(keys)',
    'onClick={() => void handleMarkPaid(settlement)}']){
    assert.ok(merchant.includes(key),key);
  }
  for(const key of ["admin_resolve_courier_settlement_dispute",'promptDialog','proof_storage_path'])
    assert.ok(admin.includes(key),key);
  for(const key of ['from("reviews")','filter === "critical"','filter === "commented"'])
    assert.ok(reviews.includes(key),key);
  for(const key of ['from("courier_locations")','from("courier_availability")',
    'onlineLocations.map((location)','<APIProvider apiKey={browserKey}>','<GoogleMap'])
    assert.ok(realtime.includes(key),key);
  assert.equal(occurrences(merchant,".limit(200)"),1);
  assert.equal(occurrences(admin,".limit(300)"),1);
  assert.equal(occurrences(reviews,".limit(500)"),1);
  assert.equal(occurrences(realtime,".limit(300)"),1);
});
