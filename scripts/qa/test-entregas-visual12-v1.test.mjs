import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";
import {patchMerchantRoute,patchReview,MARK} from "../fix-entregas-merchant-options-visual12-v1.mjs";
import {patchCouponStates,patchProductImage} from "../fix-entregas-merchant-coupons-image-visual12-v1.mjs";
import {patchAdminOrders,patchAdminCoverage,patchAdminReviewFilters,patchAdminSettlementFilters} from "../fix-entregas-admin-visual12-v1.mjs";

const root=process.cwd();
const work=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const read=path=>readFileSync(resolve(work,path),"utf8");

function formatter() {
  let source=read("src/lib/formatMerchantSelectedOptions.ts");
  source=source.replace(/^export /gm,"")
    .replace("value: unknown): string[]", "value)")
    .replace("value as Record<string, unknown>", "value")
    .replace("entry: unknown", "entry")
    .replace("entry as Record<string, unknown>", "entry");
  return new Function(source+"\nreturn formatMerchantSelectedOptions;")();
}

test("CV-039 P1: two same-name order items with different options are distinguishable in receipt and card",()=>{
  const display=formatter(),a={product_name:"Pizza sintética",quantity:1,line_total:20,
    selected_options:[{groupId:"g",groupName:"Tamanho",optionId:"a",optionName:"Grande",priceDelta:0}]};
  const b={...a,selected_options:[{groupId:"g",groupName:"Tamanho",optionId:"b",optionName:"Média",priceDelta:0}]};
  assert.deepEqual(display(a.selected_options),["Tamanho: Grande"]);
  assert.deepEqual(display(b.selected_options),["Tamanho: Média"]);
  assert.notDeepEqual(display(a.selected_options),display(b.selected_options));
  assert.deepEqual(display([]),[]);
  assert.deepEqual(display(null),[]);
  assert.deepEqual(display([{groupName:"Escolha",optionName:"Sem cebola"}]),["Escolha: Sem cebola"]);
  assert.match(display("unexpected")[0],/indisponíveis/);
  const route=read("src/routes/merchant.tsx");
  assert.equal(patchMerchantRoute(route),route,"route overlay idempotent");
  assert.ok(route.includes(MARK));
  assert.ok(route.includes("...formatMerchantSelectedOptions(item.selected_options).map"));
  assert.ok(route.includes('data-apois-cv12-merchant-options="true"'));
  for(const original of ["money(item.line_total)","money(order.subtotal)",
    "money(order.discount)","money(order.delivery_fee)","money(order.total)",
    "receipt.textContent = details.join"])assert.ok(route.includes(original));
  const review=read("src/components/MerchantOrderControlCenter.tsx");
  const again=patchReview(review);
  assert.equal(typeof again==="string"?again:again.source,review);
  if(review.includes("data-apois-merchant-order-review")){
    assert.ok(review.includes(MARK));
    assert.ok(review.includes("formatMerchantSelectedOptions(item.selected_options)"));
    assert.ok(review.includes("Pagamento direto — ainda não confirmado"));
    assert.ok(!review.includes("Pagamento direto de teste — não recebido"));
    assert.ok(review.includes("!order.order_items?.length"));
  }
});

test("CV-040: future coupons are Agendado without changing their dates/eligibility",()=>{
  const s=read("src/components/MerchantCouponsPanel.tsx");
  assert.equal(patchCouponStates(s),s);
  assert.ok(s.includes("APOIS_CV12_COUPON_STATES_V1"));
  assert.ok(s.includes("new Date(coupon.starts_at) > new Date()"));
  const expr='expired ? "Expirado" : !coupon.is_active ? "Pausado" : scheduled ? "Agendado" : "Ativo"';
  assert.ok(s.includes(expr));
  const label=new Function("expired","coupon","scheduled","return "+expr);
  assert.equal(label(false,{is_active:true},true),"Agendado");
  assert.equal(label(false,{is_active:true},false),"Ativo");
  assert.equal(label(false,{is_active:false},true),"Pausado");
  assert.equal(label(true,{is_active:true},false),"Expirado");
});

test("CV-041: coupon redemption-query failure already guarded, list failure not misreported as empty",()=>{
  const s=read("src/components/MerchantCouponsPanel.tsx");
  for(const marker of ["APOIS_COUPON_USE_READ_STATUS_V2",
    "usageState!==\"ready\"","Uso: {usageState===\"ready\" ? uses : \"Indisponível\"}",
    "setCouponListFailed(true)","couponListFailed ? (",
    "Não foi possível consultar os cupons. A lista não foi confirmada como vazia.",
    "couponListFailed ?","Tentar novamente"])assert.ok(s.includes(marker),marker);
  assert.ok(s.includes('disabled={usageState!=="ready" || uses > 0'));
  assert.ok(s.includes("Cupons já utilizados devem ser pausados"));
});

test("CV-043: upload remains original file selection, validation, reset and is reachable via keyboard",()=>{
  const s=read("src/components/MerchantProductEditor.tsx");
  assert.equal(patchProductImage(s),s);
  assert.ok(s.includes("APOIS_CV12_PRODUCT_IMAGE_KEYBOARD_V1"));
  assert.ok(s.includes('accept="image/jpeg,image/png,image/webp"'));
  assert.ok(s.includes('className="sr-only"'));
  assert.ok(s.includes("focus-within:ring-2"));
  assert.ok(s.includes("Formatos aceitos: JPG, PNG e WebP."));
  assert.ok(s.includes("if (file) void uploadImage(file);"));
  assert.ok(s.includes('event.currentTarget.value = "";'));
});

test("VIS-027, VIS-032 and VIS-034 Admin expansions: error states, named filters, pressed status",()=>{
  for(const [path,patch] of [
    ["src/components/AdminOrdersPanel.tsx",patchAdminOrders],
    ["src/components/AdminCoveragePanel.tsx",patchAdminCoverage],
    ["src/components/AdminReviewsPanel.tsx",patchAdminReviewFilters],
    ["src/components/AdminCourierSettlementsPanel.tsx",patchAdminSettlementFilters],
  ])assert.equal(patch(read(path)),read(path),"idempotence "+path);
  const orders=read("src/components/AdminOrdersPanel.tsx");
  for(const v of ["ordersLoadFailed","timelineLoadFailed","setOrdersLoadFailed(true)",
    "setTimelineLoadFailed(true)","Tentar novamente",
    "filtered.length === 0 && ordersLoadFailed ? null",
    'aria-label="Filtrar pedidos por status"',
    'aria-label="Filtrar pedidos por pagamento"',
    'aria-label="Filtrar pedidos por cidade"']) assert.ok(orders.includes(v),v);
  const coverage=read("src/components/AdminCoveragePanel.tsx");
  assert.ok(coverage.includes('aria-label={ariaLabel ?? placeholder}'));
  assert.ok(coverage.includes('aria-label="GeoJSON da zona de entrega"'));
  for(const path of ["src/components/AdminReviewsPanel.tsx","src/components/AdminCourierSettlementsPanel.tsx"]){
    const s=read(path);
    assert.ok(s.includes("aria-pressed={filter === id}"),path);
    assert.ok(s.includes("setFilter("));
  }
});

test("RV12: no source lock change; builders run only on disposable workspace before compilation",()=>{
  const lock=JSON.parse(readFileSync(resolve(root,".apois/source-lock.json"),"utf8"));
  assert.equal(lock.sources.entregas.commit,"2f4606e0fb52dffb49f2e6aebbe921ce687ab625");
  const builderNames=["scripts/build-merchant-panel.mjs","scripts/build-isolated-module.mjs"];
  for(const path of builderNames){
    const src=readFileSync(resolve(root,path),"utf8");
    for(const name of ["fix-entregas-merchant-options-visual12-v1.mjs",
      "fix-entregas-merchant-coupons-image-visual12-v1.mjs",
      "fix-entregas-admin-visual12-v1.mjs",
      "test-entregas-visual12-v1.test.mjs"]){
      assert.ok(src.includes(name),path+" missing "+name);
    }
    assert.ok(src.indexOf("fix-entregas-coupon-metrics-v2.mjs")<
      src.indexOf("fix-entregas-merchant-coupons-image-visual12-v1.mjs"));
  }
});
