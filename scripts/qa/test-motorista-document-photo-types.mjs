import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
const script=resolve("scripts/harden-motorista-document-photo-types.mjs");
test("Fotos do motorista não aceitam PDFs; CNH e CRLV preservam PDF",()=>{
 const root=mkdtempSync(resolve(tmpdir(),"apois-driver-photo-"));
 const form=resolve(root,"src/routes/motorista.cadastro.tsx");
 const field=resolve(root,"src/components/DriverDocumentField.tsx");
 mkdirSync(dirname(form),{recursive:true});mkdirSync(dirname(field),{recursive:true});
 try{
   writeFileSync(form,'<DriverDocumentField id="doc-selfie" /><DriverDocumentField id="doc-vehicle-photo" /><DriverDocumentField id="doc-cnh-front" />');
   writeFileSync(field,'if (!ALLOWED_TYPES.has(raw.type.toLowerCase())) {');
   const run=()=>execFileSync(process.execPath,[script],{cwd:resolve("."),env:{...process.env,APOIS_MOTORISTA_WORKSPACE:root}});
   run();const a=readFileSync(form,"utf8"),b=readFileSync(field,"utf8");
   assert.equal((a.match(/accept="image\/jpeg,image\/png,image\/webp"/g)||[]).length,2);
   assert.match(a,/id="doc-cnh-front"/);
   assert.match(b,/APOIS_DRIVER_DOCUMENT_FIELD_ACCEPT_V1/);
   assert.match(b,/allowedByField\.some/);
   run();assert.equal(readFileSync(form,"utf8"),a);assert.equal(readFileSync(field,"utf8"),b);
 } finally {rmSync(root,{recursive:true,force:true});}
});
test("Fotos: transformação faz parte dos dois builds",()=>{
 for(const f of ["scripts/build-motorista-module.mjs","scripts/build-partner-modules.sh"])
  assert.match(readFileSync(f,"utf8"),/harden-motorista-document-photo-types\.mjs/);
});
