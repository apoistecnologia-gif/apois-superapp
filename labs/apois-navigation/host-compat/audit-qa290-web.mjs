import {readFileSync,writeFileSync,readdirSync,statSync} from "node:fs";
import {join,relative} from "node:path";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
const [root,out]=process.argv.slice(2);
const read=p=>readFileSync(join(root,p),"utf8");
const app=read("src/routes/motorista.app.tsx");
const voice=read("src/lib/voiceNav.ts");
const lifecycle=read("src/lib/driverRideLifecycle.mobile.ts");
const checks={
  approvedVisual:["APOIS_DRIVER_HOME_PREMIUM_V1","APOIS_DRIVER_RIDE_VIDEO_AUDIT_V1"],
  operation:["<PickupNavOverlay","<ActiveTripNavOverlay","<ApoisPickupPin","onComplete={async () =>","activeRef.current","setApoisExternalNavigationOwnsVoice","launchApoisNavigationAfterRideStart"],
};
for(const markers of Object.values(checks))for(const marker of markers)assert.ok(app.includes(marker),marker);
for(const marker of ["driver_start_ride","driver-finish-redispatch","driver-cancel-redispatch"])assert.ok(lifecycle.includes(marker),marker);
assert.ok(voice.includes("tickNavigation"));
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.isFile()?[join(dir,e.name)]:[]);}
const dist=join(root,"dist/client");
const bundle=files(dist).map(f=>({path:relative(dist,f),bytes:statSync(f).size,sha256:createHash("sha256").update(readFileSync(f)).digest("hex")}));
assert.ok(bundle.length>0);
const report={sourceCommit:"9fc171050d8b5703540c49d19a8f1e9f5162775f",historicalBuilder:"6b0d31dcad5be9b7c7b9a8c651deeca98104b65f",reconciliationCommit:"a19fc0bc8e68c94dae0f1d48ff7cef2dba8ad94d",files:bundle.length,bytes:bundle.reduce((s,x)=>s+x.bytes,0),markers:checks,hashes:bundle,limits:"Compile-only synthetic config; no APK, real auth, runtime navigation or production integration."};
writeFileSync(out,JSON.stringify(report,null,2)+"\n");
console.log("[OK] generated QA290 WebView source/bundle evidence, "+bundle.length+" files");
