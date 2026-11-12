// APOIS_PASSENGER_QA217_HOME_V1 — only disposable Corridas home view.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/routes/_authenticated.inicio.tsx");
let s=readFileSync(path,"utf8");
function one(a,b,label){
 const n=s.split(a).length-1;
 if(n!==1)throw Error("[FAIL] QA217 home "+label+" count="+n);
 s=s.replace(a,b);
}
if(s.includes("APOIS_PASSENGER_QA217_HOME_V1"))throw Error("[FAIL] QA217 home duplicate");
one('import { useLocation } from "@/hooks/use-location";',
 'import { useLocation } from "@/hooks/use-location";\nimport { useNearbyPassengerDrivers } from "@/hooks/maps/use-nearby-passenger-drivers"; // APOIS_PASSENGER_QA217_HOME_V1',
 "hook import");
one('  const [isPaymentListOpen, setIsPaymentListOpen] = useState(false);',
 '  const [isPaymentListOpen, setIsPaymentListOpen] = useState(false);\n'+
 '  const nearby = useNearbyPassengerDrivers(location?.latitude,location?.longitude,selectedCategory?.code);',
 "presence state");
one('          driverLocation={undefined}',
 '          driverLocation={undefined}\n          nearbyDrivers={nearby.points}',
 "coarse map pins");
// QA219: the map conveys nearby availability via real red blinking dots alone.
// Do not cover the map with a counter, "no drivers" message or status pill.
if (s.includes("1 motorista próximo")) {
 throw Error("[FAIL] QA219: legacy fixed nearby driver label must be removed from its original component");
}
const routeBadge=readFileSync(resolve("scripts/templates/PassengerHomeRouteBadge.txt"),"utf8");
s=s.slice(0,mapEnd+2)+"\n"+routeBadge+s.slice(mapEnd+2);
for(const marker of ['APOIS_PASSENGER_QA217_HOME_V1','useNearbyPassengerDrivers(','nearbyDrivers={nearby.points}',
 'data-apois-qa217-route-distance','route.distanceMeters'])
 if(!s.includes(marker))throw Error("[FAIL] QA217 home missing "+marker);
writeFileSync(path,s,"utf8");
console.log("[OK] QA217 home: backend-confirmed km/time; driver availability is shown only by real blinking markers.");
