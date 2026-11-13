// APOIS_PARTNER_QA243_EXTERNAL_ONLY_COURIER_MAP_V1
// Mirror Motorista's operational map model: location and real markers inside
// APOIS, street navigation solely by installed Google Maps/Waze. No Route API,
// synthetic street ETA, recalculation, or write to production route metrics.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const file=resolve(root,"src/components/CourierRouteMap.tsx");
let map=readFileSync(file,"utf8");
function once(source,a,b,label){const n=source.split(a).length-1;if(n!==1)throw Error("[FAIL] QA243 map "+label+" count="+n);return source.replace(a,b);}
const mark="APOIS_PARTNER_QA243_EXTERNAL_ONLY_COURIER_MAP_V1";
if(map.includes(mark))throw Error("[FAIL] QA243 map applied twice");
for(const required of [
 "APOIS_PARTNER_EXTERNAL_NAV_UI_V1",
 "APOIS_COURIER_ROUTE_STAGE_METRICS_V1",
 "ApoisQuickMapButton",
 "update_courier_delivery_route_metrics",
 'google.maps.importLibrary("routes")',
 "Route.computeRoutes(",
 "job.pickup_latitude","job.delivery_latitude","CourierLiveMap"
])if(!map.includes(required))throw Error("[FAIL] QA243 map prerequisite "+required);

// Preserve the actually generated courier and target markers verbatim; remove
// ONLY the costly Directions effect, obsolete polyline, and route metric writes.
const start=map.indexOf("function RouteMapContent(");
const end=map.indexOf("type CourierMapMerchant",start);
if(start<0||end<=start)throw Error("[FAIL] QA243 operational map component bounds");
const legacy=map.slice(start,end);
const markerStart=legacy.indexOf("      {currentPosition ? (");
const fallbackStart=legacy.indexOf('      {routeState === "fallback" ? (',markerStart);
if(markerStart<0||fallbackStart<=markerStart)throw Error("[FAIL] QA243 native courier marker positions changed");
const markers=legacy.slice(markerStart,fallbackStart);
const replacement=[
 "// "+mark+": operational courier map only; original two markers preserved.",
 "function RouteMapContent({currentPosition,target}:{currentPosition:CourierPosition|null;target:LatLng}) {",
 "  return (",
 "    <>",
 markers.trimEnd(),
 "    </>",
 "  );",
 "}",
 "",
 ""
].join("\n");
map=map.slice(0,start)+replacement+map.slice(end);

// The route's old mutable metrics were based on road calculations. Replace by
// current GPS-to-target aerial distance, never label it as driving distance.
const activeStart=map.indexOf("export function CourierRouteMap(");
if(activeStart<0)throw Error("[FAIL] QA243 active courier map missing");
const stateStart=map.indexOf("  // APOIS_COURIER_ROUTE_STAGE_METRICS_V1:",activeStart);
const stateEnd=map.indexOf("  const target = useMemo(",stateStart);
if(stateStart<0||stateEnd<=stateStart)throw Error("[FAIL] QA243 old route state bounds");
map=map.slice(0,stateStart)+map.slice(stateEnd);
map=once(map,
"  if (!target) {",
"  const qa243DirectMeters=currentPosition&&target?distanceMeters({lat:currentPosition.lat,lng:currentPosition.lng},target):null;\n  if (!target) {",
"GPS-to-target distance");
map=once(map,
"Distância restante",
"Distância em linha reta",
"honest distance label");
map=once(map,
"{formatDistance(metrics.distanceMeters)}",
'{qa243DirectMeters===null?"Aguardando GPS":qa243DirectMeters<1?"0 m":formatDistance(qa243DirectMeters)}',
"live aerial distance");
map=once(map,
"Tempo estimado",
"Ruas e trânsito",
"route ETA label");
const oldEta='{metrics.durationSeconds > 0 ? formatDuration(metrics.durationSeconds) : "Consultar no mapa"}';
map=once(map,oldEta,"Google Maps / Waze","no fake ETA");
map=once(map,
"Rota atualizada pela sua localização",
"Localização do entregador atualizada pelo GPS",
"GPS explanation");
map=once(map,
"onMetrics={setMetrics}",
"",
"remove obsolete route metrics callback");
map=once(map,
"jobId={String(job.id)}",
"",
"remove obsolete job ID from map content");

// React TypeScript noUnusedLocals: drop imports/helpers that were exclusively
// part of the obsolete internal route estimator.
const fmtStart=map.indexOf("const formatDuration = (");
if(fmtStart>=0){
 const fmtEnd=map.indexOf("\n};",fmtStart);
 if(fmtEnd<0)throw Error("[FAIL] QA243 formatDuration end");
 map=map.slice(0,fmtStart)+map.slice(fmtEnd+3);
}
const typeStart=map.indexOf("type RouteMetrics = {");
if(typeStart>=0){
 const typeEnd=map.indexOf("\n};",typeStart);
 if(typeEnd<0)throw Error("[FAIL] QA243 RouteMetrics end");
 map=map.slice(0,typeStart)+map.slice(typeEnd+3);
}
map=map.replace(/^import \{[^}]+\} from "react";/m,(old)=>{
 const names=old.match(/\{([^}]+)\}/)?.[1]?.split(",").map(x=>x.trim())||[];
 const body=map.replace(old,"");
 const used=names.filter(name=>new RegExp("\\b"+name+"\\b").test(body));
 if(!used.length)throw Error("[FAIL] QA243 missing required React imports");
 return 'import { '+used.join(", ")+' } from "react";';
});
if(map.includes('import { supabase } from "@/integrations/supabase/client";') &&
   !map.replace('import { supabase } from "@/integrations/supabase/client";',"").includes("supabase.")){
 map=map.replace('import { supabase } from "@/integrations/supabase/client";\n',"");
}
if(/Route\.computeRoutes|importLibrary\("routes"\)|update_courier_delivery_route_metrics|setMetrics\(/.test(map))
 throw Error("[FAIL] QA243 paid directions or route metrics persistence survived");
for(const required of [
  "export function CourierLiveMap(", "export function CourierRouteMap(",
  "ApoisExternalNavigation latitude={target.lat}",
  "ApoisQuickMapButton latitude={target.lat}",
  "RecenterControl", "AdvancedMarker", "job.pickup_latitude","job.delivery_latitude"
])if(!map.includes(required))throw Error("[FAIL] QA243 protected capability "+required);
writeFileSync(file,map,"utf8");
console.log("[OK] QA243 Entregador: Google Maps/Waze own road guidance; operational markers and GPS only inside APOIS.");
