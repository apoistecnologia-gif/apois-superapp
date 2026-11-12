// APOIS_PASSENGER_QA217_ETA_V1 — route based ETA in the generated Passenger bundle.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
function patch(file,fn){
 const p=resolve(root,file),before=readFileSync(p,"utf8");
 const after=fn(before);
 if(after===before||!after.includes("APOIS_PASSENGER_QA217_ETA_V1"))
  throw Error("[FAIL] QA217 ETA patch "+file);
 writeFileSync(p,after,"utf8");
}
function one(s,a,b,label){
 const n=s.split(a).length-1;
 if(n!==1)throw Error("[FAIL] QA217 ETA "+label+" occurrences="+n);
 return s.replace(a,b);
}
const hook=resolve(root,"src/hooks/rides/use-passenger-arrival-estimate.ts");
mkdirSync(dirname(hook),{recursive:true});
writeFileSync(hook,readFileSync(resolve("scripts/templates/PassengerArrivalEstimate.ts"),"utf8"),"utf8");
patch("src/routes/_authenticated.corrida.$rideId.tsx",s=>{
 s=one(s,
 'import { useActiveRide } from "@/hooks/rides/use-active-ride";',
 'import { useActiveRide } from "@/hooks/rides/use-active-ride";\nimport { usePassengerArrivalEstimate } from "@/hooks/rides/use-passenger-arrival-estimate"; // APOIS_PASSENGER_QA217_ETA_V1',
 "ride hook import");
 s=one(s,
 '  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);',
 '  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);\n  const arrivalEstimate = usePassengerArrivalEstimate(ride,status);',
 "hook before conditional return");
 s=one(s,
 '<RideStatusHeader status={status} isRefreshing={isRefreshing} />',
 '<RideStatusHeader status={status} isRefreshing={isRefreshing}\n            driverDistanceMeters={arrivalEstimate?.distanceMeters ?? null}\n            estimatedArrivalMinutes={arrivalEstimate?.minutes ?? null} />',
 "road ETA header");
 s=one(s,'          isTrip={status === "em_viagem"}',
 '          isTrip={status === "em_viagem"}\n          approachMode={status === "motorista_a_caminho" || status === "motorista_chegou"}\n          journeyRoutePoints={arrivalEstimate?.points}',
 "road polyline map");
 return s;
});
patch("src/components/rides/active/RideStatusHeader.tsx",s=>{
 s=one(s,
 '  const hasDriverEstimate =',
 '  // APOIS_PASSENGER_QA217_ETA_V1: road ETA is provided from the existing backend.\n  const hasTripEstimate = status === "em_viagem" &&\n    driverDistanceMeters != null && estimatedArrivalMinutes != null &&\n    Number.isFinite(driverDistanceMeters) && Number.isFinite(estimatedArrivalMinutes);\n\n  const hasDriverEstimate =',
 "trip timing predicate");
 s=one(s,
 '      case "em_viagem":\n        return {\n          title: "Em viagem",\n          subtitle: "Acompanhe seu trajeto no mapa",',
 '      case "em_viagem":\n        return {\n          title: hasTripEstimate ? "Chegada ao destino em " + Math.max(1,Math.round(estimatedArrivalMinutes!)) + " min" : "Em viagem",\n          subtitle: hasTripEstimate ? formatDistance(driverDistanceMeters!) + " restantes até o destino" : "Acompanhe seu trajeto no mapa",',
 "trip destination ETA");
 return s;
});
console.log("[OK] QA217 ETA: driver-to-pickup and moving car-to-destination estimates use routed backend results.");
