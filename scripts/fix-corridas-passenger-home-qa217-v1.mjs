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
const presenceLabel='{nearby.state === "loading" ? "Buscando motoristas próximos..." : nearby.state === "unavailable" ? "Motoristas próximos indisponíveis" : nearby.points.length === 0 ? "Nenhum motorista próximo agora" : nearby.points.length + (nearby.points.length === 1 ? " motorista próximo" : " motoristas próximos")}';
if(s.includes("1 motorista próximo")){
  one("1 motorista próximo",presenceLabel,"replace old fixed count");
}else{
  const marker='      {/* CONTROLES DO MAPA (SOBRE O MAPA) */}';
  one(marker,
    '      <div data-apois-qa217-nearby-label="true" className="pointer-events-none absolute left-4 right-4 top-[calc(env(safe-area-inset-top)+80px)] z-20 text-center text-xs font-bold text-[#4B5563]"><span className="rounded-full bg-white/95 px-3 py-2 shadow-md">'+presenceLabel+'</span></div>\\n'+marker,
    "home presence label");
}
one('      {/* CONTROLES DO MAPA (SOBRE O MAPA) */}',
 readFileSync(resolve("scripts/templates/PassengerHomeRouteBadge.txt"),"utf8")+'      {/* CONTROLES DO MAPA (SOBRE O MAPA) */}',
 "visible route metrics");
for(const marker of ['APOIS_PASSENGER_QA217_HOME_V1','useNearbyPassengerDrivers(','nearbyDrivers={nearby.points}',
 'data-apois-qa217-route-distance','route.distanceMeters','Motoristas próximos indisponíveis'])
 if(!s.includes(marker))throw Error("[FAIL] QA217 home missing "+marker);
writeFileSync(path,s,"utf8");
console.log("[OK] QA217 home: backend-confirmed km/time and actual nearby count, no hardcoded driver availability.");
