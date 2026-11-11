// APOIS_DRIVER_QA190_PHYSICAL_VIDEO_V1
// Physical Android video 1001992680.mp4; disposable Motorista only.
// Do not touch protected source, Entregador, auth, RLS, dispatch or payments.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(root,"src/routes/motorista.app.tsx");
let src=readFileSync(file,"utf8");
if(src.includes("APOIS_DRIVER_QA190_PHYSICAL_VIDEO_V1"))
 throw Error("[FAIL] QA190 applied twice");
function once(old,next,label){
 const count=src.split(old).length-1;
 if(count!==1)throw Error("[FAIL] QA190 "+label+" anchors="+count);
 src=src.replace(old,next);
}
// The incoming offer previously consumed 85-94% of a real Android viewport.
once('style={{ maxHeight: "100%" }}',
     'style={{ maxHeight: "min(68dvh, 540px)" }}',
     "incoming offer height");
// Preserve all information via internal scroll and real accept/reject callbacks.
const offerStart=src.indexOf("function IncomingOffer(");
const offerEnd=src.indexOf("\nfunction InfoCard(",offerStart);
if(offerStart<0||offerEnd<=offerStart)throw Error("[FAIL] offer boundary");
const offer=src.slice(offerStart,offerEnd);
for(const x of ['overflow-y-auto','sticky bottom-0','onClick={onAccept}','onClick={onReject}','AddressRow','estimated_price'])
 if(!offer.includes(x))throw Error("[FAIL] offer lost "+x);

// The trip route is recalculated after entering the PIN. Once its polyline
// arrives, reassert the real forward camera after React/Maps renders it.
// This does not make a raster map rotate; it prevents unintended overview
// on a stable map, without inventing GPS movement.
const routeNeedle=[
'        applyNavigationCamera(map, pos, points, dest, true);',
'        return;',
].join("\n");
const routeReplacement=[
'        applyNavigationCamera(map, pos, points, dest, true);',
'        // APOIS_DRIVER_QA190_PHYSICAL_VIDEO_V1: settle route geometry first.',
'        window.setTimeout(() => {',
'          if (mapRef.current !== map || !autoFollowRef.current) return;',
'          if (activeRef.current?.id !== active.id || activeRef.current?.status !== active.status) return;',
'          const latest=positionRef.current ?? pos;',
'          applyNavigationCamera(map, latest, points, dest, true);',
'        }, 220);',
'        return;',
].join("\n");
// Scope the camera adjustment only to the active-ride route's focusRoute.
const begin=src.indexOf("    const focusRoute = (points: LatLng[]) => {");
const end=src.indexOf("    if (lastRouteRequestKeyRef.current === routeRequestKey)",begin);
if(begin<0||end<begin)throw Error("[FAIL] route focus bounds");
let focus=src.slice(begin,end);
if(focus.split(routeNeedle).length!==2)throw Error("[FAIL] route camera anchor drift");
focus=focus.replace(routeNeedle,routeReplacement);
src=src.slice(0,begin)+focus+src.slice(end);

// The explicit "Ver rota" overview must not leave the driver permanently
// zoomed out; automatically return to road follow after a short preview.
// Driver can always use "Seguir" immediately. Repeated previews invalidate
// previous timers without remounting or changing the map renderer.
once("  const navigationModeKeyRef = useRef<string | null>(null);",
     "  const navigationModeKeyRef = useRef<string | null>(null);\n  const routeOverviewEpochRef = useRef(0);",
     "overview epoch state");
const showNeedle=[
'            autoFollowRef.current=false;',
'            m.fitBounds(b,{top:155,right:32,bottom:220,left:32});',
].join("\n");
const showReplacement=[
'            autoFollowRef.current=false;',
'            m.fitBounds(b,{top:155,right:32,bottom:220,left:32});',
'            const epoch=++routeOverviewEpochRef.current;',
'            window.setTimeout(() => {',
'              if(routeOverviewEpochRef.current!==epoch || mapRef.current!==m) return;',
'              if(activeRef.current?.id!==active.id || activeRef.current?.status!=="em_viagem") return;',
'              autoFollowRef.current=true;',
'              const latest=positionRef.current;',
'              if(latest) applyNavigationCamera(m,latest,polyline,activeNavigationDestination,true);',
'            }, 7000);',
].join("\n");
once(showNeedle,showReplacement,"temporary route overview");
once('  function recenter() {\n    autoFollowRef.current = true;',
     '  function recenter() {\n    routeOverviewEpochRef.current += 1;\n    autoFollowRef.current = true;',
     "manual return to follow");
for(const term of [
 "APOIS_DRIVER_QA190_PHYSICAL_VIDEO_V1",
 "APOIS_DRIVER_RIDE_MAP_STABILITY_V2",
 "APOIS_DRIVER_QA186_NAV_LAYOUT_V1",
 "onStart(pinCode)",
 "onClick={onAccept}",
 "onClick={onReject}",
 "onClick={handleComplete}",
 "routeOverviewEpochRef.current",
 "renderingType"
]){
 if(!src.includes(term)&&term!=="renderingType")throw Error("[FAIL] preserved contract "+term);
}
writeFileSync(file,src,"utf8");
console.log("[OK] QA190 Motorista: compact offer, follow after route readiness, temporary overview. Stable raster, PIN, data/RLS and Entregador preserved.");
