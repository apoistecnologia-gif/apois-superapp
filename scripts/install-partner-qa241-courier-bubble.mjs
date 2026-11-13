// APOIS_PARTNER_QA241_COURIER_BUBBLE_V1
// Apply ONLY to disposable partner-entregador module, after QA235.
import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-entregador");
function patch(path,from,to,label){
 const file=resolve(root,path),src=readFileSync(file,"utf8");
 const count=src.split(from).length-1;
 if(count!==1)throw Error("[FAIL] QA241 Courier "+label+" anchor count "+count);
 writeFileSync(file,src.replace(from,to),"utf8");
}
const logo=Buffer.from(readFileSync(resolve("superapp/branding/apois-client-red-logo.b64"),"utf8").trim(),"base64");
if(logo.length<2000||logo.subarray(0,8).toString("hex")!=="89504e470d0a1a0a")
 throw Error("[FAIL] QA241 Courier official APOIS logo missing");
mkdirSync(resolve(root,"src/assets"),{recursive:true});
writeFileSync(resolve(root,"src/assets/apois-return-logo.png"),logo);
copyFileSync(resolve("superapp/partner-shell/shared/ApoisBubblePermissionGate.tsx"),
 resolve(root,"src/components/ApoisBubblePermissionGate.tsx"));

patch("src/routes/__root.tsx",
 'import { ApoisLaunchSplash } from "../components/ApoisLaunchSplash";',
 'import { ApoisLaunchSplash } from "../components/ApoisLaunchSplash";\n'+
 'import { ApoisBubblePermissionGate } from "../components/ApoisBubblePermissionGate";',
 "root import");
patch("src/routes/__root.tsx",
 '      <ApoisLaunchSplash />',
 '      <ApoisLaunchSplash />\n'+
 '      {getApoisProductMode()==="courier" ? <ApoisBubblePermissionGate role="entregador" /> : null}',
 "courier first-use permission");
patch("src/components/CourierRouteMap.tsx",
 'import { ApoisExternalNavigation } from "@/components/ApoisExternalNavigation";',
 'import { ApoisExternalNavigation, ApoisQuickMapButton } from "@/components/ApoisExternalNavigation";',
 "external map shortcut");
patch("src/components/CourierRouteMap.tsx",
 'stage={goingToDelivery ? "até o cliente" : "até o estabelecimento"} />',
 'stage={goingToDelivery ? "até o cliente" : "até o estabelecimento"} />\n'+
 '        <ApoisQuickMapButton latitude={target.lat} longitude={target.lng} />',
 "same return-to-external shortcut");
const courier=readFileSync(resolve(root,"src/routes/courier.tsx"),"utf8");
const map=readFileSync(resolve(root,"src/components/CourierRouteMap.tsx"),"utf8");
for(const marker of ['useApoisOperationalNotification("entregador", Boolean(activeJob))',
 'onTransition={transitionDelivery}', 'onComplete={completeDelivery}'])
 if(!courier.includes(marker))throw Error("[FAIL] QA241 Courier preserved "+marker);
for(const marker of ['update_courier_delivery_route_metrics','job.pickup_latitude','job.delivery_latitude',
 'ApoisQuickMapButton latitude={target.lat} longitude={target.lng}'])
 if(!map.includes(marker))throw Error("[FAIL] QA241 Courier preserved "+marker);
console.log("[OK] QA241 Entregador first-use bubble, official logo, Maps shortcut; GPS, offers, PIN, completion intact.");
