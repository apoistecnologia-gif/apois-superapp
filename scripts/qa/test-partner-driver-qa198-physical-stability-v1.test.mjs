import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const route=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const css=readFileSync(resolve(root,"src/styles.css"),"utf8");
function section(a,b){const x=route.indexOf(a),y=route.indexOf(b,x+a.length);assert.ok(x>=0&&y>x);return route.slice(x,y)}
test("QA198 offer never hides map under opaque #F7F7F8",()=>{
 const offer=section("function IncomingOffer(","\nfunction InfoCard(");
 for(const x of ['data-apois-driver-offer-qa195','bg-black/15 animate-in','min(48dvh, 440px)','onClick={onAccept}','onClick={onReject}','whitespace-nowrap','CountdownRing'])
  assert.ok(offer.includes(x),x);
 assert.ok(!offer.includes('bg-[#F7F7F8] animate-in fade-in'));
 assert.ok(css.includes('[data-apois-driver-offer-qa195]{background:rgba(0,0,0,.12)!important;}'));
});
test("QA198 no loss of real profile on active ride -> rating, no leak to next passenger",()=>{
 const lookup=section("  // APOIS_ASSIGNED_PASSENGER_V6:","  // countdown da oferta");
 for(const x of ["passengerIdentityRef.current === pid","if (!samePassenger) { passengerIdentityRef.current = pid; setPassenger(null); }",
  "if (record) setPassenger(record)","else if (!samePassenger) setPassenger","passengerIdentityRef.current = null","apois_driver_assigned_passenger","apois_driver_offer_passenger"])
   assert.ok(lookup.includes(x),x);
 assert.ok(route.includes("const passengerIdentityRef = useRef<string | null>(null);"));
});
test("QA198 route is never shown outside active ride; path and voice remain intact",()=>{
 for(const x of ["{active && polyline.length > 0 && (","setRouteSteps([]);","tickNavigation(","onStart(pinCode)","onClick={handleComplete}","DriverMapErrorBoundary","APOIS_DRIVER_RIDE_MAP_STABILITY_V2"])
  assert.ok(route.includes(x),x);
 assert.ok(!route.includes("{polyline.length > 0 && ("));
});
test("QA198 real review score on compact pickup/trip panels",()=>{
 for(const name of ["function PickupNavOverlay(","function ActiveTripNavOverlay("]){
  const a=route.indexOf(name),b=route.indexOf("\nfunction ",a+name.length),segment=route.slice(a,b);
  assert.ok(segment.includes("{passengerRatingText(passenger)}"),name);
  assert.ok(segment.includes("passengerFirstName(passenger?.name)"),name);
 }
 assert.ok(css.includes("a.pointer-events-none{display:none!important;}"));
});
