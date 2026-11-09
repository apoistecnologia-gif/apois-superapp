// Report 04 regression gate. Run after workspace generators, before typecheck/build.
// Synthetic File fixtures only; no browser, Supabase, Storage or user data.
import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { File } from "node:buffer";
const root=process.cwd();
const workspace=resolve(root,process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function source(p){const f=resolve(workspace,p);assert(existsSync(f),"Missing generated "+p);return readFileSync(f,"utf8");}
const helper=source("src/lib/prepareDriverPickedFile.ts");
const ts=helper
 .replace("export async function preparePickedFile(raw: File, photoOnly: boolean): Promise<File>",
          "async function preparePickedFile(raw, photoOnly)")
 .replace("(...bytes: number[])","(...bytes)");
assert(!/\b(?:export|Promise<File>|number\[\])\b/.test(ts),"Unexpected TypeScript signature");
const preparePickedFile=new Function("File",ts+"\nreturn preparePickedFile;")(File);
const sample=(bytes,type,name)=>new File([Uint8Array.from(bytes)],name,{type});
const jpeg=[0xff,0xd8,0xff,0xe0,0x00,0x10];
const png=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,1];
const webp=[0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50,0];
const pdf=[0x25,0x50,0x44,0x46,0x2d,0x31,0x2e];
let checks=0;
async function allows(file,photo,expected){const out=await preparePickedFile(file,photo);assert.equal(out.type,expected);checks++;}
async function rejects(file,photo){await assert.rejects(()=>preparePickedFile(file,photo));checks++;}
await allows(sample(jpeg,"","captura.bin"),true,"image/jpeg");
await allows(sample(png,"application/octet-stream","foto"),true,"image/png");
await allows(sample(webp,"image/webp","arquivo.webp"),true,"image/webp");
await allows(sample(pdf,"application/pdf","documento.pdf"),false,"application/pdf");
await rejects(sample(pdf,"","foto.jpg"),true);
await rejects(sample(pdf,"image/jpeg","foto.jpg"),true);
await rejects(sample(jpeg,"application/pdf","documento.pdf"),false);
await rejects(sample([1,2,3,4,5],"","fake.png"),true);
await rejects(sample([],"image/jpeg","vazio.jpg"),true);
const center=source("src/components/ApoisDriverCorrections.tsx");
const documents=source("src/routes/motorista.documentos.tsx");
const lib=source("src/lib/driverDocuments.mobile.ts");
for(const marker of ["if(!current&&loadError)","setLoadError(null)","void refresh()","preparePickedFile(file,true)"]){
 assert(center.includes(marker),"INV-047/048 missing "+marker);checks++;
}
assert(center.includes('role="alert"'),"Missing screen reader alert");checks++;
assert(documents.includes("APOIS_REPORT04_DOCUMENT_MIME"),"Document route normalization missing");checks++;
assert(documents.includes("APOIS_REPORT04_DOCUMENT_RECOVERY_MESSAGE"),"Missing reconciliation error UX");checks++;
assert(lib.includes('supabase.functions.invoke("driver-document-reconcile"'),"Reconciliation Edge contract missing");checks++;
assert(!lib.includes("cleanupUploadedObject")&&!lib.includes(".remove("),"Client-side Storage DELETE remains");checks++;
const docSql=readFileSync(resolve(root,"supabase/corridas-forward-migrations/20261109_report04_correction_proofs_QA_NOT_APPLIED.sql"),"utf8");
const queueSql=readFileSync(resolve(root,"supabase/corridas-forward-migrations/20261109_report04_document_cleanup_queue_QA_NOT_APPLIED.sql"),"utf8");
assert(docSql.includes("apois_track_driver_correction_item_revision")&&docSql.includes("required_year_not_updated"),"Missing staged per-item proof");checks++;
assert(queueSql.includes("apois_driver_document_reconcile_candidate")&&!queueSql.includes("DELETE FROM storage.objects"),"Unsafe cleanup SQL");checks++;
assert(readFileSync(resolve(root,"supabase/functions/driver-document-reconcile/index.ts"),"utf8").includes("client.auth.getUser(auth[1])"),"Edge user auth missing");checks++;
console.log("[OK] Report04 "+checks+" local synthetic/structural assertions. No uploads, SQL apply or Android execution.");
