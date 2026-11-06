// APOIS_COURIER_VIDEO_QA_20261106_V1 — read-only source assertions.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const get=(f)=>readFileSync(resolve(root,"src",f),"utf8");
const status=get("components/ApoisStatusCheck.tsx");
const views=get("components/CourierPremiumViews.tsx");
const history=get("components/CourierPanels.tsx");
const route=get("routes/courier.tsx");
const css=get("system-theme.css");
for(const marker of [
 "APOIS_COURIER_TRUE_CONNECTIVITY_VIDEO_V1","authenticated || serverReady",
 'status: "ok"','status: "unknown"'
])assert.ok(status.includes(marker),"network diagnostic regression: "+marker);
assert.ok(status.includes('add("6. Servidor de chamadas"'),"server diagnostic removed");
assert.ok(status.includes('add("5. Disponibilidade"'),"availability diagnostic removed");
assert.ok(views.includes("APOIS_COURIER_ALL_TIME_DELIVERIES_VIDEO_V1"));
assert.ok(views.includes("Concluídas (total)"));
assert.ok(!views.includes(">Entregas hoje</p>"),"total deliveries mislabeled today");
assert.ok(views.includes("metrics?.earnings_today"),"daily earnings must remain a daily metric");
assert.ok(views.includes("metrics?.online_seconds_today"),"today online time must remain");
assert.ok(views.includes("data-apois-courier-finance-contrast-v1"),"unreadable PIX notice");
assert.ok(views.includes("As entregas concluídas aparecem no histórico; os créditos registrados ficam no histórico financeiro."));
assert.ok(views.includes("A APOIS não libera saque manual"),"no payout while in homologation");
assert.ok(css.includes("APOIS_COURIER_PIX_NOTICE_CONTRAST_V1"),"notice contrast CSS missing");
assert.ok(history.includes("APOIS_COURIER_LEDGER_SEPARATION_VIDEO_V1"));
assert.ok(history.includes("data-apois-courier-ledger-separation-v1"));
assert.ok(history.includes("Estimativas nas entregas"));
assert.ok(history.includes("Saldo atual na carteira:"));
assert.ok(history.includes("{money(totalEarnings)}"),"do not merge wallet balances into job estimates");
assert.ok(history.includes("money(job.estimated_earnings)"),"do not invent courier job earnings");
assert.ok(route.includes("APOIS_COURIER_HISTORY_WALLET_READONLY_VIDEO_V1"));
assert.ok(route.includes("wallet={wallet}"),"wallet must be passed read-only into history");
for(const marker of [
 'rpc("get_courier_metrics"','get_courier_incoming_offers',
 'courier_confirm_courier_settlement','CourierBottomNav',
 'onClick={()=>setAvailableCallsOpen(true)}'
])assert.ok(route.includes(marker),"courier operational action lost: "+marker);
console.log("[OK] APOIS Entregador video: 4 tabs preserved, network verified, financial sources separate, PIX notice legible. No APK or database action.");
