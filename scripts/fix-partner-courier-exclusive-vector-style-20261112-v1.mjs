// APOIS_COURIER_EXCLUSIVE_VECTOR_MAP_20261112_V1
// Use the courier-only Google Cloud Map ID for BOTH courier map surfaces,
// preserving existing routes, GPS, markers, external navigation, payments and
// legacy inline color palette as a safe fallback when Map ID is unavailable.
// Applies exclusively to disposable .work/partner-entregador AFTER visual v4
// and active-route journey patches. Never modifies source apois-entregas.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const path=resolve(root,"src/components/CourierRouteMap.tsx");
const original=readFileSync(path,"utf8");
const marker="APOIS_COURIER_EXCLUSIVE_VECTOR_MAP_20261112_V1";
if(original.includes(marker)){
  console.log("[OK] Courier exclusive map already installed");
  process.exit(0);
}
if(!original.includes("APOIS_COURIER_CLIENT_MAP_V4") ||
   !original.includes("APOIS_COURIER_MAPS_URL_NO_API_KEY_V1")){
  throw Error("[FAIL] Missing original courier home/route protections");
}

const startHome=original.indexOf("export function CourierLiveMap(");
const startRoute=original.indexOf("export function CourierRouteMap(",startHome);
if(startHome<0||startRoute<=startHome)throw Error("[FAIL] Courier map component boundaries");
let home=original.slice(startHome,startRoute);
let route=original.slice(startRoute);

function one(source,from,to,why){
  const count=source.split(from).length-1;
  if(count!==1)throw Error("[FAIL] Courier cloud style "+why+" anchor "+count);
  return source.replace(from,to);
}
home=one(home,
 '  const activeOfferSet = useMemo(() => new Set(activeOfferMerchantIds), [activeOfferMerchantIds]);',
 `  // ${marker}: isolated Map ID only for Entregador. Do not reuse the
  // shared APOIS Cliente/Entregas Map ID or the private Motorista Map ID.
  const courierCloudMapId = String((import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID ?? "").trim();
  const useCourierCloudMap = /^[0-9a-f]{16,32}$/i.test(courierCloudMapId);
  const activeOfferSet = useMemo(() => new Set(activeOfferMerchantIds), [activeOfferMerchantIds]);`,
 "home cloud Map ID gate"
);
home=one(home,
  '              styles={APOIS_COURIER_MAP_STYLE}',
  `              mapId={useCourierCloudMap ? courierCloudMapId : undefined}
              colorScheme={ColorScheme.LIGHT}
              styles={useCourierCloudMap ? undefined : APOIS_COURIER_MAP_STYLE}`,
  "home Google Map style"
);
for(const token of [
  "<CourierStyledLiveMarkers position={mapPosition} merchants={nearbyMerchants} />",
  "<RecenterControl position=",
  'backgroundColor="#EDEAE4"',
  "clickableIcons={false}",
  "mapId={useCourierCloudMap ? courierCloudMapId : undefined}",
  "styles={useCourierCloudMap ? undefined : APOIS_COURIER_MAP_STYLE}",
])if(!home.includes(token))throw Error("[FAIL] Courier live map contract lost "+token);

// Route map already uses the VITE_GOOGLE_MAPS_MAP_ID variable.
// Do not change the job lifecycle, Routes gate, external navigation,
// target coordinates, polyline rendering, ETA or PIN.
for(const token of [
 "mapId={mapId}",
 "colorScheme={ColorScheme.LIGHT}",
 "APOIS_COURIER_MAPS_URL_NO_API_KEY_V1",
 "onClick={openNavigation}",
 "<RouteMapContent",
])if(!route.includes(token))throw Error("[FAIL] Courier active route contract lost "+token);

// A Map ID is mandatory for AdvancedMarkers on the active route.
// Fail visibly and retain its existing external NAVEGAR action when invalid.
// This is not a secret and does not add an API call.
const mapIdAnchor='  const mapId = ((import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID") as string;';
route=one(route,mapIdAnchor,
  `  // ${marker}: require a valid Google JavaScript Map ID before enabling
  // the embedded active route; never use DEMO_MAP_ID as a real identifier.
  const mapIdValue = String((import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID ?? "").trim();
  const mapId = /^[0-9a-f]{16,32}$/i.test(mapIdValue) ? mapIdValue : "";`,
  "active route valid Map ID"
);
for(const forbidden of ["1af3628136c58ef870ba9d1a","1af3628136c58ef8a23052b5","1814fa226b935f46e15c11a8"]){
  if(home.includes(forbidden)||route.includes(forbidden))
    throw Error("[FAIL] Courier source must not hard-code any Motorista/shared/style ID");
}
const updated=original.slice(0,startHome)+home+route;
if(updated===original || !updated.includes(marker))throw Error("[FAIL] Courier map unchanged");
writeFileSync(path,updated,"utf8");
console.log("[OK] Entregador: cloud vector style on idle and active maps; local home styling remains fallback; no API or billing changes.");
