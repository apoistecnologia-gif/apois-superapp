// QA239: only disposable Motorista workspace, AFTER QA236.
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(".work/partner-motorista/src/routes/motorista.app.tsx");
let s=readFileSync(file,"utf8");
function once(a,b,label){const count=s.split(a).length-1;if(count!==1)throw Error("[FAIL] QA239 "+label+" "+count);s=s.replace(a,b);}
once('import { ApoisExternalNavigation, useApoisOperationalNotification, launchApoisNavigationAfterRideStart, setApoisOperationalNotification } from "@/components/ApoisExternalNavigation";',
'import { ApoisExternalNavigation, ApoisQuickMapButton, useApoisOperationalNotification, launchApoisNavigationAfterRideStart, setApoisOperationalNotification } from "@/components/ApoisExternalNavigation";',"import");
once('      {/* MAPA */}',
'      {/* QA239: return to external Google Maps/Waze, never internal routing. */}\n'+
'      {active && ["motorista_a_caminho","motorista_chegou","em_viagem"].includes(active.status) && (\n'+
'        <ApoisQuickMapButton latitude={active.status==="em_viagem"?active.destination_lat:active.origin_lat}\n'+
'          longitude={active.status==="em_viagem"?active.destination_lng:active.origin_lng} />\n'+
'      )}\n      {/* MAPA */}',"route");
for(const marker of ['showDemandZones && demandZones.map','onStartPin={()=>setQa236PinOpen(true)}','onConfirm={handleComplete}'])
 if(!s.includes(marker))throw Error("[FAIL] QA239 lost "+marker);
writeFileSync(file,s);

/* QA240 first-run Motorista setup appears before login as part of the existing
   root, never inside the active-ride card. The Entregador bundle is untouched. */
const root=resolve(".work/partner-motorista");
const gateSource=resolve("superapp/partner-shell/shared/ApoisBubblePermissionGate.tsx");
const gateTarget=resolve(root,"src/components/ApoisBubblePermissionGate.tsx");
const logo=Buffer.from(readFileSync(resolve("superapp/branding/apois-client-red-logo.b64"),"utf8").trim(),"base64");
if(logo.length<2000||logo.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")
 throw Error("[FAIL] QA240 official logo missing");
mkdirSync(resolve(root,"src/assets"),{recursive:true});
writeFileSync(resolve(root,"src/assets/apois-return-logo.png"),logo);
copyFileSync(gateSource,gateTarget);

const mainRoot=resolve(root,"src/routes/__root.tsx");
let rootSource=readFileSync(mainRoot,"utf8");
function changeOnce(original,from,to,label){
 const n=original.split(from).length-1;
 if(n!==1)throw Error("[FAIL] QA240 "+label+" anchors="+n);
 return original.replace(from,to);
}
rootSource=changeOnce(rootSource,
 'import { DriverNativePermissionsSync } from "../components/DriverNativePermissionsSync";',
 'import { DriverNativePermissionsSync } from "../components/DriverNativePermissionsSync";\\n'+
 'import { ApoisBubblePermissionGate } from "../components/ApoisBubblePermissionGate";',
 "driver root import");
rootSource=changeOnce(rootSource,
 '          {APP_ROLE === "driver" ? <DriverNativePermissionsSync /> : null}',
 '          {APP_ROLE === "driver" ? <DriverNativePermissionsSync /> : null}\\n'+
 '          {APP_ROLE === "driver" ? <ApoisBubblePermissionGate /> : null}',
 "first-use driver modal mount");
if(!rootSource.includes("<DriverPresenceKeeper />")||!rootSource.includes("<Outlet />"))
 throw Error("[FAIL] QA240 driver GPS/auth root was changed");
writeFileSync(mainRoot,rootSource,"utf8");
console.log("[OK] QA240: official-logo OS overlay permission prompted at first Motorista entry; no opt-in buttons.");
