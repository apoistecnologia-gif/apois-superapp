// Report 02 — inspect generated workspace, not just the script existence.
// No network/SQL/application side effects. Fails build on missing integrations.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const role=process.argv[2];
assert.ok(["entregas","finance"].includes(role),"Usage: node verify-apois-report02-integrity-v1.mjs entregas|finance");
const root=role==="entregas"?".work/entregas":(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=p=>readFileSync(resolve(root,p),"utf8");
const must=(s,parts,fileName)=>{for(const part of parts)assert.ok(s.includes(part),"INV regression "+fileName+": "+part);};
if(role==="entregas"){
 const search=file("src/routes/buscar.tsx");
 must(search,["APOIS_ENTREGAS_SEARCH_INTEGRITY_V2","visibleMatchingProducts.map(","matchingProducts.map((product) => product.merchant_id)","lat1===null||lng1===null"],"search");
 assert.ok(!search.includes("      .slice(0, 40);\n  }, [\n    defaultAddress?.latitude,"),"Matching products cannot be capped before merchant matching");
 const coverage=file("src/components/AdminCoveragePanel.tsx");
 must(coverage,["APOIS_ADMIN_COVERAGE_CONSISTENCY_V2","zonesRequestRef.current","cityId: zone.city_id","latitude === null","longitude === null","_city_id: zoneDraft.id ? zoneDraft.cityId : selectedCityId"],"zones");
 assert.ok(!coverage.includes("onClick={() => setSelectedCityId(city.id)}"),"unguarded city navigation");
 const coupons=file("src/components/MerchantCouponsPanel.tsx");
 must(coupons,["APOIS_COUPON_USE_READ_STATUS_V2",'setUsageState("failed")','usageState!=="ready"',"Usos dos cupons indisponíveis."],"coupons");
 const cart=file("src/contexts/CartContext.tsx");
 must(cart,["APOIS_CART_CURRENT_CATALOG_LINE_V2","toast.info(","selectedOptions, quantity: item.quantity + 1"],"cart");
 assert.ok(!cart.includes('item.lineId === lineId ? { ...item, quantity: item.quantity + 1 }'),"old stale merge still present");
 const login=file("src/routes/login.tsx");
 must(login,["APOIS_LOGIN_ACCESSIBILITY_V2",'htmlFor="apois-login-email"','htmlFor="apois-login-password"','name="email"','name="password"','grid h-11 w-11'],"login");
 assert.equal(login.split('htmlFor="apois-login-email"').length-1,2,"Both login variants need associated email labels");
 assert.equal(login.split('htmlFor="apois-login-password"').length-1,2,"Both login variants need associated password labels");
 const hours=file("src/lib/merchant-hours.ts");
 must(hours,["APOIS_MERCHANT_HOURS_24H_V2","interval.close === interval.open","Aberto 24 horas"],"hours");
}else{
 const s=file("src/routes/admin.financeiro.tsx");
 must(s,["APOIS_ADMIN_FINANCE_CLOCK_REFRESH_V2","getAdminFinanceSummary(requestedRange.from, requestedRange.to)","Consulta atualizada:"],"finance");
}
console.log("[OK] Report 02 "+role+": workspace has expected integrity guarantees.");
