// APOIS_DRIVER_QA222_FOLLOW_REROUTE_V1. Physical Android moving test 1001992855.mp4.
// Motorista disposable workspace only. No Supabase, backend, payments, Google ID or signing edits.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
export const marker="APOIS_DRIVER_QA222_FOLLOW_REROUTE_V1";
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] QA222 "+label+" anchors="+n);return s.replace(a,b);}
// Pure geometry: shortest distance in meters to any segment of a Google Routes polyline.
export function distanceToRoute(point,path){
 if(!point||!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||!Array.isArray(path)||path.length<2)return Infinity;
 const r=Math.PI/180,m=6371000,c=Math.cos(point.lat*r);let best=Infinity;
 for(let i=1;i<path.length;i++){
  const a=path[i-1],b=path[i];if(!a||!b||![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite))continue;
  const ax=(a.lng-point.lng)*r*m*c,ay=(a.lat-point.lat)*r*m;
  const bx=(b.lng-point.lng)*r*m*c,by=(b.lat-point.lat)*r*m;
  const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
  const t=den>0?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;
  best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy));
 }return best;
}
// Require two different fixes + 7 seconds + a >=30-second provider request interval.
// Allow at most two failed retries; do not reroute on a single GPS jump.
export function advanceDeviation(prev,phase,point,distance,now,lastRequestAt,failed,failures){
 if(!Number.isFinite(distance)||distance<42)return {state:null,reroute:false};
 const valid=prev?.phase===phase&&prev.lastPoint&&prev.since<=now;
 const state=valid?{...prev}:{phase,since:now,lastAt:now,lastPoint:{lat:point.lat,lng:point.lng},observations:1};
 if(valid){
  const moved=distanceToRoute(point,[prev.lastPoint,prev.lastPoint]);
  if(moved>=9&&now-state.lastAt>=800){state.observations++;state.lastPoint={lat:point.lat,lng:point.lng};state.lastAt=now;}
 }
 return {state,reroute:state.observations>=2&&now-state.since>=7000&&Math.max(0,now-lastRequestAt)>=30000&&(!failed||failures<2)};
}
// Browser-side TS copy with the same deterministic thresholds, tested by Vite/tsc.
const geoTS=[
 "type Qa222Deviation = {phase:string;since:number;lastAt:number;lastPoint:LatLng;observations:number};",
 "function qa222DistanceToRoute(point:LatLng,path:LatLng[]):number {",
 "  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||path.length<2)return Infinity;",
 "  const r=Math.PI/180,m=6371000,c=Math.cos(point.lat*r);let best=Infinity;",
 "  for(let i=1;i<path.length;i++){",
 "    const a=path[i-1],b=path[i];if(!a||!b||![a.lat,a.lng,b.lat,b.lng].every(Number.isFinite))continue;",
 "    const ax=(a.lng-point.lng)*r*m*c,ay=(a.lat-point.lat)*r*m;",
 "    const bx=(b.lng-point.lng)*r*m*c,by=(b.lat-point.lat)*r*m;",
 "    const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;",
 "    const t=den>0?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den)):0;",
 "    best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy));",
 "  }return best;",
 "}",
 "function qa222AdvanceDeviation(prev:Qa222Deviation|null,phase:string,point:LatLng,distance:number,now:number,lastRequestAt:number,failed:boolean,failures:number):{state:Qa222Deviation|null;reroute:boolean}{",
 "  if(!Number.isFinite(distance)||distance<42)return {state:null,reroute:false};",
 "  const valid=prev?.phase===phase&&prev.lastPoint&&prev.since<=now;",
 "  const state:Qa222Deviation=valid?{...prev!}:{phase,since:now,lastAt:now,lastPoint:{lat:point.lat,lng:point.lng},observations:1};",
 "  if(valid){",
 "    const moved=qa222DistanceToRoute(point,[prev!.lastPoint,prev!.lastPoint]);",
 "    if(moved>=9&&now-state.lastAt>=800){state.observations++;state.lastPoint={lat:point.lat,lng:point.lng};state.lastAt=now;}",
 "  }",
 "  return {state,reroute:state.observations>=2&&now-state.since>=7000&&Math.max(0,now-lastRequestAt)>=30000&&(!failed||failures<2)};",
 "}"
].join("\n");
export function patchDriver(source){
 if(source.includes(marker))throw Error("[FAIL] QA222 duplicate transform");
 for(const must of [
  "APOIS_DRIVER_QA201_ROUTE_RELIABILITY_V1","APOIS_DRIVER_QA209_CAMERA_V1",
  "APOIS_DRIVER_QA220_STABLE_ANDROID_MAP_PIN_V1","APOIS_DRIVER_QA221_MAP_OWNER_COMPACT_HUD_V1",
  "onClick={onShowRoute}","onClick={onRecenter}","routeOverviewEpochRef.current",
  "  if (!immediate && previous && (movedMeters < 12 || now-previous.at < 1800)) return;",
  "      if (immediate || movedMeters >= 12) map.panTo({lat: position.lat, lng: position.lng});",
  "    const refreshDue = !samePhase || (elapsedMs >= 180000 && (movedKm >= 0.45 || (prior?.failed === true && prior.failures < 2)));"
 ])if(!source.includes(must))throw Error("[FAIL] QA222 prerequisite "+must);
 source=once(source,
  "  const routeRefreshRef = useRef<{phase: string; origin: LatLng; at: number; failed: boolean; failures: number} | null>(null);",
  "  const routeRefreshRef = useRef<{phase: string; origin: LatLng; at: number; failed: boolean; failures: number} | null>(null);\n"+
  "  // "+marker+": navigation deviation follows GPS fixes, not clock alone.\n"+
  "  const qa222DeviationRef=useRef<Qa222Deviation|null>(null);",
  "deviation tracker");
 const helper=source.indexOf("function applyNavigationCamera(");
 if(helper<0)throw Error("[FAIL] QA222 camera helper missing");
 source=source.slice(0,helper)+"// "+marker+": bounded route geometry.\n"+geoTS+"\n"+source.slice(helper);
 source=once(source,
  "  if (!immediate && previous && (movedMeters < 12 || now-previous.at < 1800)) return;",
  "  // QA222: shorter follow delay with reasonable GPS jitter filtering.\n"+
  "  if (!immediate && previous && (movedMeters < 9 || now-previous.at < 1400)) return;",
  "navigation follow timing");
 source=once(source,
  "      if (immediate || movedMeters >= 12) map.panTo({lat: position.lat, lng: position.lng});",
  [
   "      // "+marker+": follow actual GPS, correct large accumulated camera lag.",
   "      const actualCenter=map.getCenter();",
   "      const offCenterM=actualCenter?haversineKm({lat:actualCenter.lat(),lng:actualCenter.lng()},position)*1000:Infinity;",
   "      if(immediate||offCenterM>90)map.setCenter({lat:position.lat,lng:position.lng});",
   "      else if(movedMeters>=9)map.panTo({lat:position.lat,lng:position.lng});"
  ].join("\n"),
  "raster center correction");
 source=once(source,
  "  const routeOverviewEpochRef = useRef(0);",
  "  const routeOverviewEpochRef = useRef(0);\n"+
  "  const qa222OverviewActiveRef=useRef(false);\n"+
  "  const qa222LastPanAtRef=useRef(0);",
  "distinguish manual overview from accidental pan");
 const dragStart=source.indexOf("    const onDragStart = () => {");
 const dragStop=dragStart<0?-1:source.indexOf("    const listener = google.maps.event.addListener",dragStart);
 if(dragStart<0||dragStop<dragStart)throw Error("[FAIL] QA222 drag listener boundary");
 let drag=source.slice(dragStart,dragStop);
 drag=once(drag,"      autoFollowRef.current = false;",
   "      qa222LastPanAtRef.current=Date.now();\n      autoFollowRef.current = false;",
   "mark manual drag");
 source=source.slice(0,dragStart)+drag+source.slice(dragStop);
 source=once(source,
  "    if (!position || !mapRef.current || !autoFollowRef.current) return;",
  [
    "    if(!position||!mapRef.current)return;",
    "    if(!autoFollowRef.current){",
    "      // Resume an accidental user drag after 12 seconds of actual movement.",
    "      // An intentional full-route view never resumes until Seguir is clicked.",
    "      const last=qa222LastPanAtRef.current;",
    "      if(!inNavigationMode||qa222OverviewActiveRef.current||!last||Date.now()-last<12000)return;",
    "      autoFollowRef.current=true;qa222LastPanAtRef.current=0;",
    "      lastFollowAtRef.current=0;driverCameraHistory.delete(mapRef.current);",
    "    }"
  ].join("\n"),
  "GPS resumes following after accidental finger drag");
 source=once(source,
  "            autoFollowRef.current=false;\n            m.fitBounds(b,{top:155,right:32,bottom:220,left:32});",
  "            qa222OverviewActiveRef.current=true;\n"+
  "            autoFollowRef.current=false;\n            m.fitBounds(b,{top:155,right:32,bottom:220,left:32});",
  "manual Ver rota remains explicit");
 source=once(source,
  "  function recenter() {\n    routeOverviewEpochRef.current += 1;\n    autoFollowRef.current = true;",
  "  function recenter() {\n    qa222OverviewActiveRef.current=false;\n    qa222LastPanAtRef.current=0;\n    routeOverviewEpochRef.current += 1;\n    autoFollowRef.current = true;",
  "Seguir restores automatic camera");
 source=once(source,
  "    navigationModeKeyRef.current = navKey;\n    // New pickup/destination phase must not inherit the old camera bearing.",
  "    navigationModeKeyRef.current = navKey;\n    qa222OverviewActiveRef.current=false;\n    qa222LastPanAtRef.current=0;\n    // New pickup/destination phase must not inherit the old camera bearing.",
  "phase transition follow reset");
 const begin=source.indexOf("  // Rota da corrida ativa."),end=source.indexOf("  // Voz de navegação",begin);
 if(begin<0||end<=begin)throw Error("[FAIL] QA222 route effect boundaries");
 let route=source.slice(begin,end);
 route=once(route,
  "    if (!active) {\n      routeRequestEpochRef.current += 1;",
  "    if (!active) {\n      qa222DeviationRef.current=null;\n      routeRequestEpochRef.current += 1;",
  "release deviation state");
 route=once(route,
  "    const refreshDue = !samePhase || (elapsedMs >= 180000 && (movedKm >= 0.45 || (prior?.failed === true && prior.failures < 2)));",
  [
    "    // "+marker+": recalculate for sustained off-road movement, with provider cooldown.",
    "    const deviationMeters=isNavigationRideStatus(active.status)&&lastFitKeyRef.current===fitKey&&polyline.length>=2",
    "      ?qa222DistanceToRoute(pos,polyline):Infinity;",
    "    const check=qa222AdvanceDeviation(qa222DeviationRef.current,fitKey,pos,deviationMeters,now,prior?.at??now,prior?.failed===true,prior?.failures??0);",
    "    qa222DeviationRef.current=check.state;",
    "    const offRouteDue=samePhase&&check.reroute;",
    "    const refreshDue=!samePhase||offRouteDue",
    "      || (elapsedMs >= 180000 && (movedKm >= 0.45 || (prior?.failed === true && prior.failures < 2)));"
  ].join("\n"),
  "detect off-route before original 3min/450m refresh");
 route=once(route,
  "        setPolyline(points);",
  "        qa222DeviationRef.current=null;\n        setPolyline(points);",
  "clear deviation on new provider geometry");
 source=source.slice(0,begin)+route+source.slice(end);
 for(const t of [
  "qa222DistanceToRoute(pos,polyline)","offRouteDue","elapsedMs >= 180000",
  "prior.failures < 2","onClick={onRecenter}","onClick={onShowRoute}",
  "onStart(pinCode)","onClick={handleComplete}","onClick={onAccept}","onClick={onReject}",
  "data-apois-qa221-trip-hud","data-apois-qa220-pin-digit-v1"
 ])if(!source.includes(t))throw Error("[FAIL] QA222 lost "+t);
 return source;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
 const patched=patchDriver(readFileSync(file,"utf8"));
 writeFileSync(file,patched,"utf8");
 console.log("[OK] QA222 GPS camera follow + confirmed off-route reroute, constrained to generated Motorista");
}
