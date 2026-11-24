// APOIS_TRIP_DESTINATION_PREMIUM_V1: workspace only, never original source pins.
import { readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(".work/corridas");
const routePath=resolve(root,"src/routes/_authenticated.corrida.$rideId.tsx");
const componentPath=resolve(root,"src/components/rides/active/ApoisTripInProgressPremium.tsx");
const marker="APOIS_TRIP_DESTINATION_PREMIUM_V1";
function once(input,from,to,name){
  const count=input.split(from).length-1;
  if(count!==1)throw Error("[FAIL] Trip Premium "+name+" expected one anchor, got "+count);
  return input.replace(from,to);
}
let route=readFileSync(routePath,"utf8");
if(route.includes(marker)){
  console.log("[OK] Trip destination UI already installed");
  process.exit(0);
}
const imported='import { DriverCard } from "@/components/rides/active/DriverCard";';
route=once(route,imported,
 imported+'\nimport { ApoisTripInProgressPremium } from "@/components/rides/active/ApoisTripInProgressPremium";',
 "route import");
const locator='  const hasDriverLocation =';
const branch="  // APOIS_TRIP_DESTINATION_PREMIUM_V1: only backend-confirmed in-progress trip.\n  if (screenState === \"active\" && status === \"em_viagem\") {\n    return (\n      <ApoisTripInProgressPremium\n        ride={ride}\n        isRefreshing={isRefreshing}\n        isRealtimeConnected={isRealtimeConnected}\n        onBack={handleBack}\n        onRefresh={() => void refreshRide()}\n      />\n    );\n  }\n";
route=once(route,locator,branch+"\n"+locator,"in-progress switch");
writeFileSync(routePath,route,"utf8");
writeFileSync(componentPath,
  readFileSync(resolve("scripts/templates/ApoisTripInProgressPremium.tsx"),"utf8"),"utf8");

// The protected PassengerMap remains byte-for-byte unchanged.
console.log("[OK] APOIS Cliente: viagem premium usa somente props publicas do mapa existente.");
