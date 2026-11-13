// QA243 no-APK regression gates against actual disposable Courier output.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const courier=read("src/routes/courier.tsx");
const panels=read("src/components/CourierPremiumViews.tsx");
const map=read("src/components/CourierRouteMap.tsx");
const bubble=readFileSync(resolve("scripts/android/APOISReturnBubble.java"),"utf8");

test("QA243: today's deliveries use an authenticated exact date-bound read, not historical RPC totals",()=>{
 const necessary=[
   "APOIS_PARTNER_QA243_COURIER_DAILY_STATS_V1",
   "qa243DayBounds(timezone)",
   '.eq("courier_id",courierId).eq("status","delivered").or(filter)',
   '.select("id",{head:true,count:"exact"})',
   'delivered_at.is.null,updated_at.gte.',
   'completed_deliveries_today:deliveredToday',
   "qa243ZonedMidnightUtc",
   'rpc("get_courier_metrics", { _timezone: timezone })',
   'setActiveJob(jobsRes.data ?? null)',
 ];
 for(const s of necessary)assert.ok(courier.includes(s),s);
 const start=panels.indexOf("export function CourierWaitingSheet(");
 const end=panels.indexOf("export function CourierOfflineCard(",start);
 assert.ok(start>=0&&end>start,"waiting sheet present");
 const waiting=panels.slice(start,end);
 assert.ok(waiting.includes('data-apois-qa243-real-today="true"'));
 assert.ok(waiting.includes('metrics?.completed_deliveries_today == null ? "—"'));
 assert.ok(!waiting.includes("metrics?.completed_deliveries ?? 0"),"historical count cannot appear as today");
 assert.ok(panels.includes("String(metrics?.completed_deliveries ?? 0)"),"historical finance total retained");
});

test("QA243: Courier has same external-only road navigation as Motorista; local operational markers remain",()=>{
 for(const s of [
  "APOIS_PARTNER_QA243_EXTERNAL_ONLY_COURIER_MAP_V1",
  "export function CourierLiveMap(",
  "export function CourierRouteMap(",
  "ApoisExternalNavigation latitude={target.lat}",
  "ApoisQuickMapButton latitude={target.lat}",
  "AdvancedMarker",
  "nearbyMerchants.map",
  "RecenterControl",
  "job.pickup_latitude",
  "job.delivery_latitude",
  "qa243DirectMeters",
  "Distância em linha reta",
  "Ruas e trânsito",
  "Google Maps / Waze"
 ])assert.ok(map.includes(s),s);
 for(const forbidden of [
  'google.maps.importLibrary("routes")',
  "Route.computeRoutes(",
  "update_courier_delivery_route_metrics",
  "VITE_APOIS_ENTREGAS_LIVE_ROUTING",
  "setMetrics(",
  "routeState",
 ])assert.ok(!map.includes(forbidden),"no internal route billing or phantom metrics: "+forbidden);
});

test("QA243: original GPS, delivery progression, PIN, and role-aware native return bubble unchanged",()=>{
 for(const s of [
  "CourierLocationTracker", "useApoisOperationalNotification",
  'onTransition={transitionDelivery}', 'onComplete={completeDelivery}',
  "courier_confirm_courier_settlement"
 ])assert.ok(courier.includes(s),s);
 for(const s of [
  'R.drawable.apois_return_logo',
  '"activeRole"','"entregador"',
  'br.com.apois.parceiro://module/entregador',
  "app.startActivity(back)"
 ])assert.ok(bubble.includes(s),s);
});
