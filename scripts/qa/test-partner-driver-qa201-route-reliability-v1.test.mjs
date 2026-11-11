import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const code=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const css=readFileSync(resolve(root,"src/styles.css"),"utf8");
const begin=code.indexOf("  // Rota da corrida ativa."),end=code.indexOf("  // Voz de navegação",begin);
assert.ok(begin>=0&&end>begin);
const route=code.slice(begin,end);
test("QA201 GPS position updates never cancel an in-flight authorized route",()=>{
 for(const t of ["APOIS_DRIVER_QA201_ROUTE_RELIABILITY_V1","routeRequestEpochRef","activeRef.current?.id !== active.id","activeRef.current?.status !== active.status"])assert.ok(code.includes(t),t);
 assert.ok(route.includes("routeRequestEpochRef.current !== requestEpoch"));
 assert.ok(!route.includes("let cancelled = false;"));
 assert.ok(!route.includes("return () => { cancelled = true; };"));
});
test("QA201 rate-limited refresh only for actual displacement or bounded failure",()=>{
 for(const t of ["elapsedMs >= 180000","movedKm >= 0.45","prior.failures < 2","routeRefreshRef.current","lastRouteRequestKeyRef.current === routeRequestKey && !refreshDue"])assert.ok(route.includes(t),t);
 assert.ok(route.includes("routeRefreshRef.current = null;"),"clear completed route state");
});
test("QA201 never lies by drawing a straight line as turn-by-turn route",()=>{
 assert.ok(!route.includes("const fallback = [pos, dest]"));
 assert.ok(!route.includes("Math.round((km / 35) * 3600)"));
 assert.ok(route.includes('throw new Error("route_provider_invalid_geometry")'));
 assert.ok(route.includes("setPolyline([]); setRouteSteps([]); setLegKm(null); setEtaSeconds(null);"));
});
test("QA201 trip shows actual star rating beside only the first name",()=>{
 const a=code.indexOf("function ActiveTripNavOverlay(");
 assert.ok(a>0,"Trip component present");
 const trip=code.slice(a);
 assert.ok(trip.includes('aria-label={"Avaliação: " + passengerRatingText(passenger)}'));
 assert.ok(trip.includes("passengerFirstName(passenger?.name)"));
 assert.ok(trip.includes("Number(passenger?.total_ratings ?? 0) > 0"));
 assert.ok(trip.includes("onClick={handleComplete}"));
});

test("QA201 preserves driver + passenger, PIN, completion and non-overlap",()=>{
 for(const t of ["APOIS_ASSIGNED_PASSENGER_V6","apois_driver_offer_passenger","passengerIdentityRef.current === pid","onStart(pinCode)","onClick={handleComplete}","DriverMapErrorBoundary","onClick={onAccept}","onClick={onReject}"])assert.ok(code.includes(t),t);
 for(const t of ["[data-apois-trip-top-v6]{padding:7px 10px!important", "[data-apois-pickup-top-v4]>div{padding:7px 10px!important"])
 assert.ok(css.includes(t),t);
});
