// APOIS_DRIVER_QA209_FINISHED_ROUTE_V1
// Always wait for authenticated server confirmation before ending UI.
// Then clear every native route overlay immediately, not seconds later.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
let s=readFileSync(path,"utf8");
const marker="APOIS_DRIVER_QA209_FINISHED_ROUTE_V1";
if(s.includes(marker))throw Error("[FAIL] QA209 route cleanup duplicate");
function once(a,b,label){const count=s.split(a).length-1;if(count!==1)throw Error("[FAIL] QA209 route "+label+" count="+count);s=s.replace(a,b);}
function section(start,end,label,fn){const a=s.indexOf(start),b=a<0?-1:s.indexOf(end,a+start.length);if(a<0||b<a)throw Error("[FAIL] QA209 "+label+" bounds");const old=s.slice(a,b),next=fn(old);if(old===next)throw Error("[FAIL] QA209 "+label+" unchanged");s=s.slice(0,a)+next+s.slice(b);}
function insideOnce(t,a,b,label){const c=t.split(a).length-1;if(c!==1)throw Error("[FAIL] QA209 "+label+" anchors="+c);return t.replace(a,b);}
once('  const mapRef = useRef<google.maps.Map | null>(null);',[
'  const mapRef = useRef<google.maps.Map | null>(null);',
'  // '+marker+': native overlays must disappear synchronously after server success.',
'  const driverRouteOverlayRefs = useRef<Set<google.maps.Polyline>>(new Set());',
'  function clearDriverRouteVisuals() {',
'    driverRouteOverlayRefs.current.forEach((line) => line.setMap(null));',
'    driverRouteOverlayRefs.current.clear();',
'    routeRequestEpochRef.current += 1;',
'    routeRefreshRef.current = null;',
'    lastRouteRequestKeyRef.current = null;',
'    lastFitKeyRef.current = null;',
'    setPolyline([]); setRouteSteps([]); setEtaSeconds(null); setLegKm(null);',
'  }'
].join("\n"),"native polyline cleanup");
const poly='<Polyline path={polyline} options={{';
const count=s.split(poly).length-1;
if(count!==3)throw Error("[FAIL] QA209 expected three route polylines, count="+count);
s=s.replaceAll(poly,'<Polyline onLoad={(line) => { driverRouteOverlayRefs.current.add(line); }} onUnmount={(line) => { driverRouteOverlayRefs.current.delete(line); }} path={polyline} options={{');
if(!s.includes('{active && polyline.length > 0 && ('))throw Error("[FAIL] QA209 active-only polyline absent");
section('      if (r.status === "finalizada") {','      } else if (r.status === "cancelada_passageiro"',"server completion",part=>
 insideOnce(part,'        setActive(null); setPolyline([]);',
  '        setActive(null); clearDriverRouteVisuals();',"remove route on realtime final"));
section('      } else if (r.status === "cancelada_passageiro"', '      } else if (r.status === "motorista_a_caminho"',"server cancellation",part=>
 insideOnce(part,'        setActive(null);\n        setPolyline([]);',
  '        setActive(null);\n        clearDriverRouteVisuals();',"remove route on realtime cancel"));
section("  async function handleDriverCancelRide(","  // ===== CONTROLADOR ÚNICO DE CÂMERA =====","driver cancellation",part=>
 insideOnce(part,'      setActive(null);\n      setPolyline([]);\n      setEtaSeconds(null);\n      setLegKm(null);',
   '      setActive(null);\n      activeRef.current = null;\n      clearDriverRouteVisuals();',"remove route on own cancellation"));
const begin=s.indexOf("<ActiveTripNavOverlay");
const finish=begin<0?-1:s.indexOf("        />",begin);
if(begin<0||finish<begin)throw Error("[FAIL] QA209 active trip onComplete missing");
let call=s.slice(begin,finish);
// Earlier ride visual hardener already stores the authoritative completedRide
// and ratingRef on success. Do not replace it with fabricated local rating data.
const completeAnchor="ratingRef.current = completedRide;";
if(call.split(completeAnchor).length!==2)throw Error("[FAIL] QA209 completedRide success anchor count="+(call.split(completeAnchor).length-1));
call=call.replace(completeAnchor,completeAnchor+"\n"+[
 "            // Server already confirmed completion. Clear the view synchronously.",
 "            const completedRideId = active.id;",
 "            if (activeRef.current?.id === completedRideId) activeRef.current = null;",
 "            setActive((previous) => previous?.id === completedRideId ? null : previous);",
 "            if (!activeRef.current || activeRef.current.id === completedRideId) clearDriverRouteVisuals();"
].join("\n"));
s=s.slice(0,begin)+call+s.slice(finish);
for(const t of [
marker,"clearDriverRouteVisuals()","driverRouteOverlayRefs.current.forEach((line) => line.setMap(null))",
"setActive((previous) => previous?.id === completedRideId ? null : previous)",
"{active && polyline.length > 0 && (","routeRequestEpochRef.current += 1",
"onStart(pinCode)","onClick={handleComplete}","apois_driver_assigned_passenger"
])if(!s.includes(t))throw Error("[FAIL] QA209 lost "+t);
writeFileSync(path,s,"utf8");
console.log("[OK] QA209 finished-route cleanup on server confirmation, cancel and immediate native polyline release.");
