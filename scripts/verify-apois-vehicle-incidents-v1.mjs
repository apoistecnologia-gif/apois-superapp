import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const role=process.argv[2];
assert.ok(["corridas","partner"].includes(role),"use corridas/partner");
const root=resolve(role==="corridas"?".work/corridas":".work/partner-motorista");
const read=path=>readFileSync(resolve(root,path),"utf8");
const sql=readFileSync("supabase/corridas-forward-migrations/20261031_vehicle_inspection_and_cases_QA_NOT_APPLIED.sql","utf8");
for(const marker of ["NÃO APLICADA","apois_vehicle_inspection_photos",
"apois_vehicle_inspection_review_events","apois_require_vehicle_inspection",
"apois_case_events","apois_case_evidence","ENABLE ROW LEVEL SECURITY",
"apois_case_access","apois_open_ride_case","apois_case_reply",
"apois_case_internal_note","apois_request_driver_statement","driver_response_requested_at","apois_case_register_evidence",
"visible_to_parties","storage.objects FOR SELECT TO authenticated",
"driver_id=NEW.id","review_status='approved'",
"REVOKE ALL ON public.apois_case_events,public.apois_case_evidence",
"CREATE POLICY \"apois initial driver documents upload own\""]){
 assert.ok(sql.includes(marker),"Privacy migration required: "+marker);
}
assert.ok(!sql.includes("UPDATE public.rides"),"No ride lifecycle mutation");
assert.ok(!sql.includes("DROP TABLE public.rides"),"No legacy table removal");
if(role==="partner"){
 const signup=read("src/routes/motorista.cadastro.tsx");
 const uploader=read("src/lib/driverRegistration.mobile.ts");
 const staff=read("src/routes/admin.motoristas.tsx");
 const admin=read("src/routes/admin.suporte.tsx");
 const driver=read("src/routes/motorista.suporte.tsx");
 const workroom=read("src/components/ApoisCaseWorkroom.tsx");
 for(const marker of ["APOIS_VEHICLE_SIX_PHOTOS_V1","front_seats","rear_seats","dashboard","right","left","inspectionReady"])
 assert.ok(signup.includes(marker),"Missing driver photo step: "+marker);
 for(const marker of ["APOIS_VEHICLE_INSPECTION_UPLOAD_V1","apois-inspections","apois_submit_driver_vehicle_inspection","registrationAttempted=true;","if(!registrationAttempted&&!committed)"])
 assert.ok(uploader.includes(marker),"Missing immutable upload step: "+marker);
 assert.ok((uploader.match(/upsert: false,/g)||[]).length>=2,"New registration objects must never request Storage overwrite");
 assert.ok(!uploader.includes("upsert: true"),"Private evidence cannot use upsert:true");
 for(const marker of ["APOIS_ADMIN_INSPECTION_REVIEW_V1","apois_review_vehicle_photo","inspection_photos","Visualizar foto internamente"])
 assert.ok(staff.includes(marker),"Missing admin review: "+marker);
 assert.ok(driver.includes("ApoisCaseWorkroom"),"Driver must have response UI");
 assert.ok(admin.includes("ApoisCaseWorkroom"),"Admin must have case workspace");
 assert.ok(workroom.includes("apois_request_driver_statement"),"Staff must invite driver only after triage");
 // INV-002/003/004/005/016: final transformed Workroom, not only generator.
 for(const marker of ["APOIS_CASE_CONTEXT_SAFE_V2","APOIS_CASE_UPLOAD_IDEMPOTENCY_V2","detailSequence.current===sequence","draftsRef.current.set(previous","Anexo indisponível."])
  assert.ok(workroom.includes(marker),"Workroom integrity marker missing: "+marker);
 assert.ok(!workroom.includes("href={file.url??undefined}"),"Unavailable evidence cannot remain an inert anchor");
 assert.ok(workroom.includes("apois_case_reply")&&workroom.includes("apois_case_internal_note"),"Case response/private notes missing");
 assert.ok(workroom.includes('disabled={role==="staff"&&privateNote}'),"Internal notes must not upload party-visible files");
}else{
 const active=read("src/routes/_authenticated.corrida.$rideId.tsx");
 const cases=read("src/components/ApoisCaseCenter.tsx");
 const archive=read("src/routes/_authenticated.ocorrencias.tsx");
 for(const marker of ["Reportar problema com esta corrida","ApoisCaseCenter"])
 assert.ok(active.includes(marker),"Active trip missing case action");
 for(const marker of ["apois_open_ride_case","apois_case_reply","apois_case_register_evidence","apois-case-evidence","createSignedUrl","Meus protocolos"])
 assert.ok(cases.includes(marker),"Case center missing "+marker);
 assert.ok(archive.includes("ApoisCaseCenter"),"Case archive route missing");
 const history=read("src/routes/_authenticated.corridas.tsx");
 // INV-006/007: link is in the CURRENT restored history, not an obsolete placeholder.
 assert.ok(history.includes("APOIS_CASES_ARCHIVE_V2")&&history.includes('<Link to="/ocorrencias"'),"Case archive link missing in history");
 assert.equal(history.split('<Link to="/ocorrencias"').length-1,1,"Case archive link duplicated");
 assert.ok(active.includes("bg-[#FFF1F2]")&&active.includes("text-[#991B1B]"),"Case-report text must contrast on light footer");
 for(const marker of ["APOIS_CASE_CENTER_CONTEXT_SAFE_V2","APOIS_PASSENGER_EVIDENCE_IDEMPOTENT_V2","detailSequence.current===sequence","setNewCaseFiles"])
  assert.ok(cases.includes(marker),"Passenger case integrity marker missing: "+marker);
 assert.ok(!cases.includes('from("passenger_support_tickets").insert('),"Ticket must be created through authenticated server RPC");
}
console.log("[OK] "+role+": private vehicle inspection, protocol case flow and owner-bound evidence guards verified.");
