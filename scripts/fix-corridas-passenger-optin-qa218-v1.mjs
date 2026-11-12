// QA218 Passenger: explicit opt-in only; generated Corridas workspace.
import {mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const path=resolve(root,"src/routes/_authenticated.inicio.tsx");
let s=readFileSync(path,"utf8");
function once(a,b,label){
 const n=s.split(a).length-1;
 if(n!==1)throw Error("[FAIL] QA218 opt-in "+label+" count="+n);
 s=s.replace(a,b);
}
if(s.includes("APOIS_PASSENGER_QA218_OPTIN_V1"))throw Error("[FAIL] QA218 opt-in duplicate");
once('import PassengerMap from "@/components/map/PassengerMap";',
 'import PassengerMap from "@/components/map/PassengerMap";\nimport { PassengerDemandSharing } from "@/components/map/PassengerDemandSharing"; // APOIS_PASSENGER_QA218_OPTIN_V1',
 "import passenger map");
once("function InicioPage() {",
 "function InicioPage() {\\n  const { user: demandUser } = useAuth();",
 "dedicated authenticated presence identity");
const start=s.indexOf("<PassengerMap");
const end=start<0?-1:s.indexOf("/>",start);
if(start<0||end<0||end-start>900)throw Error("[FAIL] QA218 map JSX changed");
const insert='\n        <PassengerDemandSharing authUserId={demandUser?.id} latitude={location?.latitude}\n          longitude={location?.longitude} showControl={!hasDestination} />';
s=s.slice(0,end+2)+insert+s.slice(end+2);
const file=resolve(root,"src/components/map/PassengerDemandSharing.tsx");
mkdirSync(dirname(file),{recursive:true});
writeFileSync(file,readFileSync(resolve("scripts/templates/PassengerDemandSharing.tsx"),"utf8"),"utf8");
for(const text of ["APOIS_PASSENGER_QA218_OPTIN_V1",
 "PassengerDemandSharing authUserId={user?.id}","showControl={!hasDestination}",
 "useNearbyPassengerDrivers","data-apois-qa217-route-distance"])
 if(!s.includes(text))throw Error("[FAIL] QA218 lost "+text);
writeFileSync(path,s,"utf8");
console.log("[OK] QA218 Passageiro: opt-in anonimo de compartilhamento montado sem tocar em login/GPS/checkout.");
