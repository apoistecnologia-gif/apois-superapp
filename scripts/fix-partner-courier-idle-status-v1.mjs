import { existsSync,readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador","src/routes/courier.tsx");
if(!existsSync(path))throw Error("[FAIL] Courier route not found");
let s=readFileSync(path,"utf8");
if(!s.includes("APOIS_COURIER_STATUS_IDLE_ONLY_V1")){
 const from='<div data-apois-courier-inline-status className="mx-auto w-full max-w-lg py-2">';
 const old='<CourierStatusCard online={online} busy={busy === "online"} activeJob={activeJob} onToggle={toggleOnline} />';
 if(s.includes(from) && s.includes(old)){
  s=s.replace('        '+from,'        {/* APOIS_COURIER_STATUS_IDLE_ONLY_V1 */}\n        {!activeJob && !completedJob ? (\n        '+from);
  s=s.replace('        </div>\n      </main>\n\n      <CourierSupportSheet','        </div>\n        ) : null}\n      </main>\n\n      <CourierSupportSheet');
 }else{
  const before=[
   '        <CourierStatusCard',
   '          online={online}',
   '          busy={busy === "online"}',
   '          activeJob={activeJob}',
   '          onToggle={toggleOnline}',
   '        />'
  ].join("\n");
  if(!s.includes(before))throw Error("[FAIL] Courier availability placement unknown");
  s=s.replace(before,'        {/* APOIS_COURIER_STATUS_IDLE_ONLY_V1 */}\n        {!activeJob && !completedJob ? (\n'+before+'\n        ) : null}');
 }
}
if(!s.includes("APOIS_COURIER_STATUS_IDLE_ONLY_V1") || !s.includes("!activeJob && !completedJob")){
 throw Error("[FAIL] Courier availability must not obscure an active route");
}
writeFileSync(path,s,"utf8");
console.log("[OK] Courier online status appears only while idle; active navigation gets map priority");
