// QA239: ensure Google/Waze alone calculate road guidance during Motorista operation.
// Generated disposable Motorista workspace only. No change to GPS, dispatch, PIN, finance, or protected source.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const path=resolve(root,"src/routes/motorista.app.tsx");
const recoveryPath=resolve(root,"src/components/DriverActiveRideRecovery.tsx");
let route=readFileSync(path,"utf8"),recovery=readFileSync(recoveryPath,"utf8");
const mark="APOIS_QA239_EXTERNAL_ROUTES_ONLY_V1";
if(route.includes(mark)||recovery.includes(mark))throw Error("[FAIL] QA239 duplicate");
function one(s,before,after,label){const count=s.split(before).length-1;if(count!==1)throw Error("[FAIL] QA239 "+label+" anchors "+count);return s.replace(before,after);}
if(!route.includes("APOIS_PARTNER_QA235_ONE_NAVIGATION_V1")||!route.includes("APOIS_PARTNER_QA236_PICKUP_PIN_V1"))throw Error("[FAIL] QA239 requires approved QA235/236");
if(!route.includes('rpc("apois_get_driver_demand_zones")')||!route.includes('rpc("apois_driver_passenger_hotspots")'))throw Error("[FAIL] QA239 cannot lose demand zones");
const start=route.indexOf("  // Rota da corrida ativa.");
const finish=route.indexOf("  // Voz de navegação",start);
if(start<0||finish<=start)throw Error("[FAIL] QA239 route effect boundaries");
let effect=route.slice(start,finish);
effect=one(effect,
 "    if (!active) {",
 [
 "    // "+mark+": active ride route is OWNED by Google Maps/Waze externally.",
 "    // Driver map remains an operational status/GPS and demand-zones map.",
 "    if (active) {",
 "      routeRequestEpochRef.current += 1;",
 "      routeRefreshRef.current = null;",
 "      lastRouteRequestKeyRef.current = null;",
 "      setPolyline(previous => previous.length ? [] : previous);",
 "      setEtaSeconds(previous => previous === null ? previous : null);",
 "      setLegKm(previous => previous === null ? previous : null);",
 "      return;",
 "    }",
 "    if (!active) {"
 ].join("\n"),"active map route guard");
route=route.slice(0,start)+effect+route.slice(finish);
// Secondary recovery is also prevented from reaching Routes, even when main map is unmounted.
recovery=one(recovery,
 "  useEffect(() => {\n    if (mainDriverOwnsMap()) {",
 "  useEffect(() => {\n    // "+mark+": session recovery is data-only; no map route billing.\n    clearLines();\n    return;\n    if (mainDriverOwnsMap()) {",
 "secondary recovery guard");
for(const token of ['useDriverBroadcast(','showDemandZones && demandZones.map','qa235ArrivalRef.current','onStartPin={()=>setQa236PinOpen(true)}','onConfirm={handleComplete}','ApoisExternalNavigation latitude={ride.destination_lat}']){
 if(!route.includes(token))throw Error("[FAIL] QA239 prerequisite "+token);
}
writeFileSync(path,route);writeFileSync(recoveryPath,recovery);
console.log("[OK] QA239: no internal Motorista paid route calls while online/active; demand zones/GPS/PIN untouched.");
