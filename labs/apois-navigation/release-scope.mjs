import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {pathToFileURL} from "node:url";

// Guard the entire experiment against the fixed original baseline, not just
// the preceding commit. This is a scope/integrity check, not a release permit.
export const baseline="cb970bbb2d4fe5358b64d24dc31de8fcbcc3bff4";
const workflow=/^\.github\/workflows\/apois-navigation-lab-[a-z0-9-]+\.yml$/;
const forbidden=/\.(?:apk|aab|jks|keystore|p12|pfx|pem|key)$/i;
export function allowedPath(path){
  if(typeof path!=="string"||path.includes("\\")||path.split("/").some(p=>!p||p==="."||p===".."))return false;
  return !forbidden.test(path)&&
    (path.startsWith("labs/apois-navigation/")||workflow.test(path));
}
export function assertLabScope(paths){
  assert.ok(paths.length>0,"empty experiment comparison");
  const outside=paths.filter(p=>!allowedPath(p));
  assert.equal(outside.length,0,"Out-of-scope paths: "+outside.join(", "));
}
export function assertDisabledHost(source){
  const declarations=source.match(/const EXPERIMENTAL_INTERNAL_NAVIGATION\s*:\s*boolean\s*=\s*false\s*;/g)||[];
  assert.equal(declarations.length,1,"The experimental flag must remain hard disabled");
  assert.equal((source.match(/enabled:EXPERIMENTAL_INTERNAL_NAVIGATION/g)||[]).length,1);
  assert.ok(source.includes("if(!EXPERIMENTAL_INTERNAL_NAVIGATION)return ()=>{};"));
}
export function assertPrivateManifest(xml){
  assert.ok(!/<(?:uses-permission|permission|service|provider|receiver|intent-filter)\b/i.test(xml),"unexpected component or permission");
  const activities=[...xml.matchAll(/<activity\b[^>]*>/g)].map(m=>m[0]);
  assert.equal(activities.length,2);
  for(const name of ["LabNavigationActivity","ConfirmedLiveNavigationActivity"]){
    const tag=activities.filter(a=>a.includes('android:name="br.com.apois.navigation.lab.'+name+'"'));
    assert.equal(tag.length,1);
    assert.ok(tag[0].includes('android:exported="false"'));
  }
}
export function audit(root){
  const git=(...args)=>execFileSync("git",["-C",root,...args],{encoding:"utf8",maxBuffer:8*1024*1024});
  const head=git("rev-parse","HEAD").trim();
  git("merge-base","--is-ancestor",baseline,head);
  // --no-renames checks both removed and added paths of a rename.
  const changed=git("diff","--no-renames","--name-only","-z",baseline,head).split("\0").filter(Boolean);
  assertLabScope(changed);
  // Also catch uncommitted tracked/untracked changes in a local preflight.
  const working=git("diff","--no-renames","--name-only","-z","HEAD").split("\0").filter(Boolean);
  const untracked=git("ls-files","--others","--exclude-standard","-z").split("\0").filter(Boolean);
  assert.equal(working.length+untracked.length,0,"audit requires a clean checkout");
  const read=p=>readFileSync(join(root,"labs/apois-navigation",p),"utf8");
  assertDisabledHost(read("host-compat/prepare-qa290-web-host.mjs"));
  assertPrivateManifest(read("android/probe/src/main/AndroidManifest.xml"));
  assert.ok(read("valhalla/route-gateway.mjs").includes('.listen(port,"127.0.0.1"'));
  // The source can only remain inactive until a separate reviewed activation.
  const native=read("android/probe/src/main/java/br/com/apois/navigation/lab/NativeConfirmedHost.kt");
  assert.ok(native.includes("private var configuration:NativeHostConfiguration?=null"));
  assert.ok(native.includes("val config=configuration?:run{opened.accept(null);return}"));
  const report={baseline,head,changedPaths:changed.length,productionPaths:0,experimentalFlag:false,
    nativeHostDefault:null,labGateway:"loopback",activitiesExported:false,apkAuthorized:false,
    releaseReady:false,blockers:["independent destination provenance","authorized remote routing infrastructure",
      "device rendering and audio","explicit APK authorization","production licensing and deployment approval"]};
  console.log(JSON.stringify(report,null,2));return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)audit(resolve(process.argv[2]??"."));
