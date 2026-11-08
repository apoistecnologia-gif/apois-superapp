import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
const script=resolve("scripts/harden-motorista-registration-insert-only.mjs");
test("Motorista: cadastro troca apenas uploads com nome novo para INSERT-only",()=>{
 const wd=mkdtempSync(resolve(tmpdir(),"apois-driver-docs-")),path=resolve(wd,"src/lib/driverRegistration.mobile.ts");
 mkdirSync(dirname(path),{recursive:true});
 try{
  const original=[
   'const path = authUser.id + "/doc-new.jpg";',
   'const upload = await supabase.storage.from(doc.bucket).upload(path, body, {',
   '        upsert: true,',
   '      });',
   'const avatar = await supabase.storage.from("profile-photos").upload(photoPath, body, {',
   '          upsert: true,',
   '        });',
  ].join("\n");
  writeFileSync(path,original);
  const run=()=>execFileSync(process.execPath,[script],{cwd:resolve("."),env:{...process.env,APOIS_MOTORISTA_WORKSPACE:wd}});
  run();const patched=readFileSync(path,"utf8");
  assert.equal((patched.match(/upsert: false,/g)||[]).length,2);
  assert.doesNotMatch(patched,/upsert: true,/);
  assert.match(patched,/APOIS_DRIVER_DOCS_CREATE_ONLY_V1/);
  run();assert.equal(readFileSync(path,"utf8"),patched,"idempotência");
 } finally { rmSync(wd,{recursive:true,force:true}); }
});
test("Motorista: os dois pipelines aplicam upload INSERT-only",()=>{
 const solo=readFileSync("scripts/build-motorista-module.mjs","utf8");
 const partner=readFileSync("scripts/build-partner-modules.sh","utf8");
 assert.match(solo,/harden-motorista-registration-insert-only\.mjs/);
 assert.match(partner,/harden-motorista-registration-insert-only\.mjs/);
});
