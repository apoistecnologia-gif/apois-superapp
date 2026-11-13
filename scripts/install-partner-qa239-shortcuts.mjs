// QA239: only disposable Motorista workspace, AFTER QA236.
import {readFileSync,writeFileSync} from "node:fs";
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
for(const marker of ['showDemandZones && demandZones.map','onStartPin={()=>setQa236PinOpen(true)}','onClick={handleComplete}'])
 if(!s.includes(marker))throw Error("[FAIL] QA239 lost "+marker);
writeFileSync(file,s);
console.log("[OK] QA239 in-app floating map shortcut uses external Android intent");
