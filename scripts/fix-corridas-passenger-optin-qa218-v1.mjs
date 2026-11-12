// QA219 Passenger: no-map-overlay sharing with persistent opt-out in Perfil; generated Corridas only.
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
 "function InicioPage() {\n  const { user: demandUser } = useAuth();",
 "dedicated authenticated presence identity");
const start=s.indexOf("<PassengerMap");
const end=start<0?-1:s.indexOf("/>",start);
if(start<0||end<0||end-start>900)throw Error("[FAIL] QA218 map JSX changed");
const insert='\n        <PassengerDemandSharing authUserId={demandUser?.id} latitude={location?.latitude}\n          longitude={location?.longitude} />';
s=s.slice(0,end+2)+insert+s.slice(end+2);
const file=resolve(root,"src/components/map/PassengerDemandSharing.tsx");
mkdirSync(dirname(file),{recursive:true});
writeFileSync(file,readFileSync(resolve("scripts/templates/PassengerDemandSharing.tsx"),"utf8"),"utf8");
for(const text of ["APOIS_PASSENGER_QA218_OPTIN_V1",
 "PassengerDemandSharing authUserId={demandUser?.id}","PassengerDemandPrivacySettings",
 "useNearbyPassengerDrivers","data-apois-qa217-route-distance"])
 if(!s.includes(text))throw Error("[FAIL] QA218 lost "+text);
// QA219: remove large map card. The privacy preference belongs in Perfil.
const profilePath=resolve(root,"src/routes/_authenticated.perfil.tsx");
let profile=readFileSync(profilePath,"utf8");
const originalImport='import { PassengerProfilePhoto } from "@/components/profile/PassengerProfilePhoto";';
if(profile.split(originalImport).length!==2)throw Error("[FAIL] QA219 profile photo import changed");
profile=profile.replace(originalImport,
  'import { PassengerDemandPrivacySettings } from "@/components/map/PassengerDemandSharing"; // APOIS_PASSENGER_QA219_PRIVACY_V1\\n'+originalImport);
const profileAnchor='        <div className="p-6 mt-4">\\n          <PassengerAccountDeletion';
if(profile.split(profileAnchor).length!==2)throw Error("[FAIL] QA219 profile privacy insertion anchor changed");
profile=profile.replace(profileAnchor,
 '        <div className="p-6 mt-4">\\n          <div className="mb-4"><PassengerDemandPrivacySettings authUserId={user?.id} /></div>\\n          <PassengerAccountDeletion');
for(const required of [
  'APOIS_PASSENGER_QA219_PRIVACY_V1',
  'PassengerDemandPrivacySettings authUserId={user?.id}',
  '<PassengerAccountDeletion',
  '<PassengerProfilePhoto',
  '<PassengerCompletedRideCount',
])if(!profile.includes(required))throw Error("[FAIL] QA219 missing "+required);
writeFileSync(profilePath,profile,"utf8");

writeFileSync(path,s,"utf8");
console.log("[OK] QA218 Passageiro: compartilhamento em primeiro plano sem overlay, com desativacao no Perfil sem tocar em login/GPS/checkout.");
