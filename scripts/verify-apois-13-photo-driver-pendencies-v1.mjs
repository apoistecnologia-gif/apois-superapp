import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista");
const file=(path)=>readFileSync(resolve(root,path),"utf8");
const sql=readFileSync("supabase/corridas-forward-migrations/20261031_vehicle_inspection_and_cases_QA_NOT_APPLIED.sql","utf8");
const pendingSQL=readFileSync("supabase/corridas-forward-migrations/20261031_driver_correction_notifications_QA_NOT_APPLIED.sql","utf8");
const form=file("src/routes/motorista.cadastro.tsx");
const uploader=file("src/lib/driverRegistration.mobile.ts");
const admin=file("src/routes/admin.motoristas.tsx");
const driverDocs=file("src/routes/motorista.documentos.tsx");
const driverStatus=file("src/routes/motorista.status.tsx");
const correctionComponent=file("src/components/ApoisDriverCorrections.tsx");
const mailer=readFileSync("supabase/functions/apois-driver-review-mailer/index.ts","utf8");
const slots=["front","right","left","dashboard","front_seats","rear_seats","tire_fl","tire_fr","tire_rl","tire_rr","belt_front","belt_rear","headlights_on"];
for(const slot of slots){
 for(const [what,source] of [["SQL",sql],["Admin",admin]])assert.ok(source.includes(slot),what+" missing photo "+slot);
 if(slot!=="front"){
  assert.ok(form.includes(slot),"Driver form missing "+slot);
  assert.ok(uploader.includes(slot),"Upload missing "+slot);
 }
}
assert.equal(slots.length,13);
for(const token of ["APOIS_CAR_MANUFACTURE_10Y_V1","new Date().getFullYear()-10","Ano de fabricação","min={vehicleCategory"]){
 assert.ok(form.includes(token),"Year business rule missing "+token);
}
for(const token of ["extract(year from CURRENT_DATE)::int-10","apois_inspection_required","review_status='approved'","latest WHERE latest.review_status='approved')<13"]){
 assert.ok(sql.includes(token),"Approval SQL guard missing "+token);
}
for(const token of ["APOIS_ADMIN_PENDING_CORRECTIONS_V1","Pendenciar cadastro e notificar motorista",
"apois_admin_request_driver_correction","apois-driver-review-mailer",
"internalPreview","<iframe","Visualizar foto internamente"]){
 assert.ok(admin.includes(token),"Admin workflow missing "+token);
}
for(const token of ["ApoisDriverCorrections","apois_driver_correct_inspection_photo","apois_driver_correct_manufacture_year",
"apois_driver_resubmit_corrections","crypto.randomUUID().replace","upsert:false"]){
 assert.ok(correctionComponent.includes(token)||driverDocs.includes(token)||driverStatus.includes(token),"Driver correction missing "+token);
}
for(const token of ["apois_driver_correction_requests","apois_driver_my_corrections",
"apois_driver_resubmit_corrections","apois_prevent_approval_during_corrections",
"apois_admin_can_dispatch_driver_correction_mail",
"public.notifications","REVOKE ALL"]){
 assert.ok(pendingSQL.includes(token),"RLS/correction backend missing "+token);
}
for(const token of ["getUser(token)","apois_admin_can_dispatch_driver_correction_mail","RESEND_API_KEY",
"APOIS_EMAIL_FROM","Idempotency-Key","accepted_by_provider"]){
 assert.ok(mailer.includes(token),"Email dispatch missing "+token);
}
assert.ok(!mailer.includes("SUPABASE_SERVICE_ROLE_KEY\")??"),"Do not log service role credentials");
assert.ok(!sql.includes("UPDATE public.rides"),"Safety feature should not affect trips");
console.log("[OK] 13-photo vehicle safety, manufacture<=10y, Admin pending/review, app notice & queued email gates");
