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
assert.ok(uploader.includes("registrationAttempted=true;"),"Registration must mark ambiguous RPC boundary");
assert.ok(uploader.includes("if(!registrationAttempted&&!committed)"),"Upload cleanup must stop after an ambiguous registration RPC");
assert.ok(uploader.includes("new Promise<void>(resolve=>setTimeout(resolve,350))"),"Inspector upload retry should remain bounded");
assert.ok(uploader.includes("const retry=await (supabase as any).rpc(\"apois_submit_driver_vehicle_inspection\""),"Inspector retry must only repeat idempotent RPC");
const frontStorageReview=readFileSync("database/review/20261103_corridas_inspection_front_storage_guard_REVIEW_ONLY.sql","utf8");
for(const marker of ["REVIEW ONLY; NOT APPLIED","front_photo_storage_missing_or_not_owned","o.bucket_id='vehicle-documents'","o.name=d.vehicle_photo_url","o.owner_id=(SELECT auth.uid())::text"])
  assert.ok(frontStorageReview.includes(marker),"Proposed frontal Storage ownership check missing "+marker);
assert.ok(admin.includes('disabled={Boolean(inspectionBusy)||!photo.url}'),"Admin must not approve missing signed vehicle photo");
const staffStorageReview=readFileSync("database/review/20261103_corridas_admin_inspection_review_storage_guard_REVIEW_ONLY.sql","utf8");
for(const marker of ["REVIEW ONLY; NOT APPLIED","private.has_permission('users.manage')","inspection_photo_missing_or_unowned","JOIN storage.objects o ON o.bucket_id=p.bucket_id AND o.name=p.object_path","o.owner_id=u.auth_user_id::text"])
  assert.ok(staffStorageReview.includes(marker),"Server-side photo approval Storage ownership guard missing "+marker);

assert.ok(!sql.includes("UPDATE public.rides"),"Safety feature should not affect trips");
console.log("[OK] 13-photo vehicle safety, manufacture<=10y, Admin pending/review, app notice & queued email gates");
