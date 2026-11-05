// AF-03: reproducible fingerprint of the exact Partner Motorista Web bundle.
// Runs after the shell build. Does not sign an APK or access remote systems.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
const root=resolve(".");
const motor=resolve(root,"superapp/partner-shell/dist/modules/motorista");
const partnerShell=resolve(root,"superapp/partner-shell/dist/index.html");
if(!existsSync(motor)||!existsSync(partnerShell))throw Error("[FAIL] Motorista fingerprint requires final Partner shell build");
function digest(content){return createHash("sha256").update(content).digest("hex");}
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(d=>{const p=resolve(dir,d.name);if(d.isSymbolicLink())throw Error("No symlink in built APK assets: "+p);return d.isDirectory()?walk(p):d.isFile()?[p]:[];});}
const all=walk(motor).sort();
if(!all.some(p=>p.endsWith("/index.html")))throw Error("[FAIL] Motorista bundle index missing");
const files=all.map(path=>({path:relative(root,path).split("\\").join("/"),bytes:statSync(path).size,sha256:digest(readFileSync(path))}));
const lock=readFileSync(resolve(root,".apois/source-lock.json"));
const source=JSON.parse(lock.toString());
const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
const body={
  schema:"apois.partner.motorista.build-fingerprint.v1",
  root_commit_sha:head,
  source_pin:source.sources?.corridas_motorista_admin?.commit ?? null,
  canonical_backend_project:"tbbzkrfupmqdywnzgnms",
  app_package:"br.com.apois.parceiro",
  source_lock_sha256:digest(lock),
  shell_index_sha256:digest(readFileSync(partnerShell)),
  files,
};
mkdirSync(resolve(root,"build"),{recursive:true});
const output=resolve(root,"build/apois-partner-motorista-build-fingerprint.json");
writeFileSync(output,JSON.stringify(body,null,2)+"\n","utf8");
console.log("[OK] Motorista build fingerprint: "+head+" | "+files.length+" assets | "+digest(readFileSync(output)).slice(0,16));
// The signed APK is built by a later Android workflow; its own SHA256 must be recorded separately.
