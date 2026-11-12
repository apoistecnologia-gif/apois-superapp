import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const s=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const css=readFileSync(resolve(root,"src/styles.css"),"utf8");
function section(a,b){const x=s.indexOf(a),y=x<0?-1:s.indexOf(b,x+a.length);assert.ok(x>=0&&y>x,a);return s.slice(x,y);}
test("QA209 filtered, single-invocation vector camera ignores noise, large leaps and duplicate timers",()=>{
 const c=section("function applyNavigationCamera(","type RequestRemovalReason");
 for(const term of ["driverCameraHistory","movedMeters < 12","now-previous.at < 1800",
 "movedMeters > 700","NAVIGATION_CENTER_AHEAD_METERS",
 "routeHeadingFrom(position,route,destination)","getRenderingType?.()",
 "google.maps.RenderingType.VECTOR","navMap.moveCamera({","tilt:nearDestination ? 0 : 25"])assert.ok(c.includes(term),term);
 assert.ok(s.includes("const NAVIGATION_CENTER_AHEAD_METERS = 52;"));
 assert.ok(s.includes("const NAVIGATION_ZOOM = 17;"));
 assert.ok(!c.includes("navMap.setHeading?.("));
 const route=section("  // Rota da corrida ativa.","  // Voz de navegação");
 assert.ok(!route.includes("}, 220);"));
 assert.ok(route.includes('if (active.status === "motorista_chegou")'));
 assert.ok(s.includes("if (mapRef.current === m) return;"));
});
test("QA209 remove three native polylines synchronously only after successful ride completion",()=>{
 const callback=section("<ActiveTripNavOverlay","        />");
 assert.ok(callback.indexOf("await callComplete(")>=0);
 assert.ok(callback.indexOf("clearDriverRouteVisuals()")>callback.indexOf("await callComplete("));
 for(const t of ["driverRouteOverlayRefs.current.forEach((line) => line.setMap(null))",
 "routeRequestEpochRef.current += 1","setPolyline([]); setRouteSteps([]); setEtaSeconds(null); setLegKm(null);",
 "{active && polyline.length > 0 && (",
 "setActive((previous) => previous?.id === completedRideId ? null : previous)",
 "ratingRef.current = completedRide;"])
 assert.ok(s.includes(t),t);
 assert.equal(s.split('onLoad={(line) => { driverRouteOverlayRefs.current.add(line); }}').length-1,3);
 assert.ok(s.includes("if (r.status === \"finalizada\") {"));
});
test("QA209 PIN has four real focusable inputs and a blinking caret, not a transparent control",()=>{
 const pin=section("function ActiveRidePanel(","\nfunction ActionButton(");
 for(const t of [
 "const pinDigitRefs = useRef<Array<HTMLInputElement | null>>([]);",
 "const [pinFocusedIndex, setPinFocusedIndex] = useState<number | null>(null)",
 'aria-label="PIN de quatro dígitos"','maxLength={1}','inputMode="numeric"',
 "onFocus={() => {","onChange={(event) => {","onPaste={(event) => {",
 "onKeyDown={(event) => {","pinDigitRefs.current[position] = node",
 'data-apois-pin-caret="true"', "Toque em qualquer quadradinho para digitar o PIN",
 "onStart(pinCode)", "onClick={() => void submitPin()}"
 ])assert.ok(pin.includes(t),t);
 assert.ok(!pin.includes('className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"'));
 assert.ok(!pin.includes('<label htmlFor="apois-motorista-pin-v4"'));
 assert.ok(css.includes("@keyframes apois-pin-caret-blink"));
});
test("QA209 does not alter passenger/offer APIs, driver dispatch or entitlement, and preserves Google Cloud style gate",()=>{
 for(const t of ["apois_driver_offer_passenger","apois_driver_assigned_passenger",
  "passengerFirstName(passenger?.name)","onClick={onAccept}","onClick={onReject}",
  "DriverMapErrorBoundary","onClick={handleComplete}","routeRequestEpochRef"])
 assert.ok(s.includes(t),t);
});
