// PDF physical ride UX 12/11/2026: offline regression tests on disposable
// .work/partner-motorista. Never make network/Google calls or build an APK.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const src=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const css=readFileSync(resolve(root,"src/styles.css"),"utf8");
function section(begin,end){
 const a=src.indexOf(begin),b=a<0?-1:(end==="__EOF__"?src.length:src.indexOf(end,a+begin.length));
 assert.ok(a>=0&&b>a,begin+" to "+end);
 return src.slice(a,b);
}
const offer=section("function IncomingOffer(","\nfunction InfoCard(");
const pickup=section("function PickupNavOverlay(","\nfunction CircleAction(");
const waiting=section("function ActiveRidePanel(","\nfunction ActionButton(");
const trip=section("function ActiveTripNavOverlay(","__EOF__");
test("P1 offer expands on tap; real passenger and preferences remain visible with accept/reject",()=>{
 for(const value of ["data-apois-offer-expandable-v1","setOfferExpanded","aria-expanded={offerExpanded}","Ver passageiro e preferências",
  "CountdownRing","onClick={onAccept}","onClick={onReject}","<ApoisRideComfortCard details={ride.service_details}","onClick={onOpenProfile}"])
  assert.ok(offer.includes(value),value);
 assert.equal((offer.match(/data-apois-offer-expandable-v1/g)||[]).length,1);
 assert.ok(!offer.includes('min(44dvh, 410px)'));
});
test("P2 no repeated passenger photo/name card on pickup; calling and profile stay available",()=>{
 assert.ok(pickup.includes("data-apois-pickup-compact-v1"));
 assert.ok(pickup.includes("Siga para o embarque"));
 assert.ok(pickup.includes("Ver perfil"));
 assert.ok(pickup.includes("onClick={onOpenProfile}"));
 assert.ok(pickup.includes("href={`tel:${passenger.phone}`}"));
 assert.ok(pickup.includes("onClick={handleArrive}"));
 assert.ok(pickup.includes("onClick={handleCancel}"));
 assert.ok(!pickup.includes("aria-label=\"Ver perfil do passageiro\""));
});
test("P3 only fixed waiting/preferences summary above CTA; legacy sheet kept for PIN state but invisible",()=>{
 assert.ok(src.includes("data-apois-waiting-sheet-host-v1"));
 assert.ok(src.includes('active.status === "motorista_chegou" ? "invisible pointer-events-none"'));
 assert.ok(waiting.includes("data-apois-waiting-summary-v1"));
 assert.ok(waiting.includes("Aguardando passageiro"));
 assert.ok(waiting.includes("Peça o PIN"));
 assert.ok(waiting.includes("Preferências do passageiro"));
 assert.ok(waiting.includes("details={ride.service_details}"));
});
test("P4-P5 no-show CTA hidden while typing PIN; four real inputs and server verification intact",()=>{
 assert.equal((waiting.match(/isArrived && !pinOpen && !cancelOpen && createPortal/g)||[]).length,2);
 assert.ok(waiting.includes("data-apois-pin-v4"));
 assert.ok(waiting.includes('flex items-start justify-center overflow-y-auto'));
 assert.ok(!waiting.includes('flex items-start justify-center overflow-hidden'), "Android PIN modal must remain scrollable");
 assert.ok(waiting.includes("focus({ preventScroll: true })"));
 assert.ok(waiting.includes('onStart(pinCode)'));
 assert.ok(waiting.includes("pinCode.length !== 4"));
 assert.ok(waiting.includes("pinDigitRefs"));
 assert.ok(waiting.includes("Confirmar PIN e iniciar corrida"));
 assert.ok(css.includes("[data-apois-pin-v4], [data-apois-pin-v4] > div { animation:none!important;"));
});
test("P6 one compact trip top HUD, with route/follow and completion preserved",()=>{
 assert.ok(trip.includes("data-apois-trip-single-hud-v1"));
 assert.ok(trip.includes("data-apois-trip-one-metrics-v1"));
 assert.equal((trip.match(/data-apois-trip-one-metrics-v1/g)||[]).length,1);
 assert.ok(trip.includes("onClick={onShowRoute}"));
 assert.ok(trip.includes("onClick={onRecenter}"));
 assert.ok(trip.includes("onClick={handleComplete}"));
 assert.ok(trip.includes("data-apois-trip-bottom-v6"));
});
test("No payment, PIN, backend, GPS or previous QA209 map protections altered",()=>{
 for(const value of ["APOIS_DRIVER_QA209_REAL_PIN_V1","APOIS_DRIVER_QA209_CAMERA_V1",
   "APOIS_DRIVER_QA201_ROUTE_RELIABILITY_V1",
   "apois_driver_assigned_passenger",
   "onClick={onAccept}","onClick={onReject}",
   "onClick={handleComplete}","onStart(pinCode)","applyNavigationCamera("])
 assert.ok(src.includes(value),value);
});
