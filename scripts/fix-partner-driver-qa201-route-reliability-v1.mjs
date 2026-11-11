// APOIS_DRIVER_QA201_ROUTE_RELIABILITY_V1
// Source: real QA197 physical video and code review, Motorista ONLY.
// Fix the in-flight GPS cancellation race, bounded re-route, and misleading
// straight-line/estimated-time fallback. Retain Maps renderer, partner signing,
// protected modules, billing and all ride lifecycle contracts unchanged.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const path=resolve(root,"src/routes/motorista.app.tsx");
const cssPath=resolve(root,"src/styles.css");
let s=readFileSync(path,"utf8"),css=readFileSync(cssPath,"utf8");
const marker="APOIS_DRIVER_QA201_ROUTE_RELIABILITY_V1";
if(s.includes(marker)||css.includes(marker))throw Error("[FAIL] QA201 applied twice");
function one(from,to,label){
 const n=s.split(from).length-1;
 if(n!==1)throw Error("[FAIL] QA201 "+label+" count="+n);
 s=s.replace(from,to);
}
one(
 '  const lastRouteRequestKeyRef = useRef<string | null>(null);',
 [
 '  const lastRouteRequestKeyRef = useRef<string | null>(null);',
 '  // '+marker+': a GPS tick must never cancel an in-flight route query.',
 '  const routeRequestEpochRef = useRef(0);',
 '  const routeRefreshRef = useRef<{phase: string; origin: LatLng; at: number; failed: boolean; failures: number} | null>(null);',
 '  useEffect(() => () => { routeRequestEpochRef.current += 1; }, []);'
 ].join("\n"),
 "route snapshot refs"
);
const start=s.indexOf("  // Rota da corrida ativa.");
const end=start<0?-1:s.indexOf("  // Voz de navegação",start);
if(start<0||end<=start)throw Error("[FAIL] QA201 route effect bounds");
let route=s.slice(start,end);
function rOne(from,to,label){
 const n=route.split(from).length-1;
 if(n!==1)throw Error("[FAIL] QA201 "+label+" in effect="+n);
 route=route.replace(from,to);
}
rOne(
 '    if (!active) {\n      setPolyline([]);',
 '    if (!active) {\n      routeRequestEpochRef.current += 1;\n      routeRefreshRef.current = null;\n      setPolyline([]);',
 "invalidate after active ride"
);
rOne(
 '    if (!dest) { setPolyline([]); return; }',
 '    if (!dest) { routeRequestEpochRef.current += 1; routeRefreshRef.current = null; setPolyline([]); return; }',
 "invalidate when no destination"
);
rOne(
 '    const routeRequestKey = fitKey;',
 [
 '    const routeRequestKey = fitKey;',
 '    const now = Date.now();',
 '    const prior = routeRefreshRef.current;',
 '    const samePhase = prior?.phase === fitKey;',
 '    // Hard cap: no recalculation for mere GPS jitter or idle position.',
 '    // After 3min only a meaningful 450m movement or max two failure retries.',
 '    const elapsedMs = prior ? Math.max(0, now - prior.at) : Number.POSITIVE_INFINITY;',
 '    const movedKm = prior ? haversineKm(prior.origin, pos) : Number.POSITIVE_INFINITY;',
 '    const refreshDue = !samePhase || (elapsedMs >= 180000 && (movedKm >= 0.45 || (prior?.failed === true && prior.failures < 2)));'
 ].join("\n"),
 "bounded refresh threshold"
);
rOne(
 '    if (lastRouteRequestKeyRef.current === routeRequestKey) {',
 '    if (lastRouteRequestKeyRef.current === routeRequestKey && !refreshDue) {',
 "skip when not due"
);
rOne(
 '    lastRouteRequestKeyRef.current = routeRequestKey;',
 [
 '    lastRouteRequestKeyRef.current = routeRequestKey;',
 '    const requestEpoch = ++routeRequestEpochRef.current;',
 '    routeRefreshRef.current = {',
 '      phase: fitKey, origin: { lat: pos.lat, lng: pos.lng }, at: now, failed: false,',
 '      failures: samePhase ? (prior?.failures ?? 0) : 0,',
 '    };'
 ].join("\n"),
 "register in flight"
);
rOne('    let cancelled = false;\n    callRoute(',
     '    callRoute(',
     "do not cancel because GPS changes");
const oldCancelled='        if (cancelled) return;';
const occurrences=route.split(oldCancelled).length-1;
if(occurrences!==2)throw Error("[FAIL] QA201 expected 2 async callbacks, found "+occurrences);
route=route.replaceAll(oldCancelled,
 '        if (routeRequestEpochRef.current !== requestEpoch || activeRef.current?.id !== active.id || activeRef.current?.status !== active.status) return;');
rOne(
 '        const points = decodePolyline(res.encodedPolyline);\n        setPolyline(points);',
 [
 '        const points = decodePolyline(res.encodedPolyline);',
 '        if (!Array.isArray(points) || points.length === 0 || !Number.isFinite(res.durationSeconds) || !Number.isFinite(res.distanceMeters)) {',
 '          throw new Error("route_provider_invalid_geometry");',
 '        }',
 '        if (routeRefreshRef.current?.phase === fitKey) {',
 '          routeRefreshRef.current.failed = false;',
 '          routeRefreshRef.current.failures = 0;',
 '        }',
 '        setPolyline(points);'
 ].join("\n"),
 "reject invalid provider response"
);
const fallback=[
 '        // Fallback: mantém marcadores e desenha linha reta para não quebrar UX.',
 '        const fallback = [pos, dest];',
 '        setPolyline(fallback);',
 '        setRouteSteps([]);',
 '        const km = haversineKm(pos, dest);',
 '        setLegKm(km); setEtaSeconds(Math.round((km / 35) * 3600));',
 '        focusRoute(fallback);'
].join("\n");
rOne(fallback,[
 '        // NO fabricated route or ETA when Google Routes fails.',
 '        // Keep a previous verified route during same phase, or show only endpoints.',
 '        const snapshot = routeRefreshRef.current;',
 '        if (snapshot?.phase === fitKey) { snapshot.failed = true; snapshot.failures += 1; }',
 '        if (lastFitKeyRef.current !== fitKey) {',
 '          setPolyline([]); setRouteSteps([]); setLegKm(null); setEtaSeconds(null);',
 '        }'
].join("\n"),"honest fallback");
rOne('    return () => { cancelled = true; };',
'    // Deliberately no per-GPS-tick cleanup. Epoch and activeRef guard stale work.',
"prevent GPS cancellation of route");
if(route.includes("if (cancelled)")||route.includes("const fallback = [pos, dest]")||route.includes("(km / 35) * 3600")){
 throw Error("[FAIL] QA201 stale cancellation or fake ETA survived");
}
s=s.slice(0,start)+route+s.slice(end);
// Fix QA195's selector: trip has data attribute on the card itself,
// unlike pickup whose data attribute sits on the outer wrapper.
css+="\n/* "+marker+" — HUD padding scoped to Motorista, not Entregador. */\n"+
'[data-apois-trip-top-v6]{padding:7px 10px!important;border-radius:16px!important;box-shadow:0 7px 18px -13px rgba(17,24,39,.35)!important;}\n'+
'[data-apois-trip-top-v6] .mb-2,[data-apois-pickup-top-v4] .mb-2{margin-bottom:2px!important;}\n'+
'[data-apois-pickup-top-v4]>div{padding:7px 10px!important;}\n';
for(const required of ["routeRequestEpochRef.current !== requestEpoch","refreshDue","routeRefreshRef.current","apois_driver_assigned_passenger","onStart(pinCode)","onClick={handleComplete}","onClick={onAccept}","onClick={onReject}"]){
 if(!s.includes(required))throw Error("[FAIL] QA201 lost "+required);
}
writeFileSync(path,s,"utf8");writeFileSync(cssPath,css,"utf8");
console.log("[OK] QA201 code staged: GPS route query survives, at most one refresh after 450m and 3min, no fake route/ETA, compact trip HUD.");
