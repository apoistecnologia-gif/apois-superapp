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
assert.ok(!app.includes("tickNavigation(")&&!app.includes("void speak(firstInstruction"),"QA235 no duplicate maneuver speech");
for(const marker of ["APOIS_NAVIGATION_QA290_GENERATED_VOICE_GUARD","stopVoiceForHandoff","setLegacyGuidanceAllowed","confirmedSpeechAllowed(opts?.guidance) && enabled","beginConfirmedVoiceHandoff","if (!current() || confirmedVoiceScope) return;"])assert.ok(voice.includes(marker),marker);
const javaRoot="android-motorista/app/src/main/java/com/apois/motorista/";
const java=read(javaRoot+"DriverVoicePlugin.java");
const generation=read(javaRoot+"VoiceGeneration.java");
for(const marker of ['@CapacitorPlugin(name = "DriverVoice")','generation.accepts(ticket)','result.put("stopped", stopped)','2200L','SharedGuidanceAudio.INSTANCE.beforeLegacySpeech(this)','SharedGuidanceAudio.INSTANCE.stopForLegacy(this)'])assert.ok(java.includes(marker),marker);
const hash=s=>createHash("sha256").update(s).digest("hex");
const voiceEvidence={web:hash(voice),java:hash(java),generation:hash(generation),mode:"QA235 external default preserved; strict stop and scoped native-only alerts; generated Java references shared engine adapter; no native registration change or physical audio test"};
const host=read("src/lib/apois-navigation-lab/host.ts");
for(const marker of ["APOIS_NAVIGATION_QA290_CONFIRMED_HOST","const EXPERIMENTAL_INTERNAL_NAVIGATION:boolean=false","supabase.auth.getUser()",'supabase.rpc("driver_get_profile")','select("id,status,driver_id,accepted_driver_id,category")','native.openConfirmed(request)','native.closeConfirmed({sessionId})','Capacitor.isPluginAvailable(nativeName)','native.addListener("confirmedRideIntent"','launch.onNativeClosed(event)','launch.recheck()','prepareAudio:beginConfirmedVoiceHandoff','native.confirmedAvailability()','native.cancelConfirmedPreparation(request)','!await ensureNativeListener()||!current()'])assert.ok(host.includes(marker),marker);
for(const marker of ["APOIS_NAVIGATION_QA290_CONFIRMED_LAUNCH","bindConfirmedNavigationLifecycle()","observeConfirmedNavigationRide(active?.id",'launchConfirmedApoisNavigation(accepted.id, "PICKUP"','launchConfirmedApoisNavigation(ride.id, "TRIP"'])assert.ok(app.includes(marker),marker);
const launchEvidence={host:hash(host),authority:hash(read("src/lib/apois-navigation-lab/motorista-authority.mjs")),policy:hash(read("src/lib/apois-navigation-lab/confirmed-navigation-launch.mjs")),mode:"hard disabled, original external callback preserved, native transport linked; no production plugin registered or live provider"};
const launchSites=app.split("\n").map((line,index)=>({line:index+1,code:line.trim()})).filter(x=>x.code.includes("launchApoisNavigationAfterRideStart("));
assert.ok(launchSites.some(x=>x.code.includes("accepted.origin_lat")),"confirmed accept pickup launch");
assert.ok(launchSites.some(x=>x.code.includes("ride.destination_lat")),"confirmed PIN destination launch");
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.isFile()?[join(dir,e.name)]:[]);}
const dist=join(root,"dist/client");
const bundle=files(dist).map(f=>({path:relative(dist,f),bytes:statSync(f).size,sha256:createHash("sha256").update(readFileSync(f)).digest("hex")}));
assert.ok(bundle.length>0);
const report={sourceCommit:"9fc171050d8b5703540c49d19a8f1e9f5162775f",historicalBuilder:"6b0d31dcad5be9b7c7b9a8c651deeca98104b65f",reconciliationCommit:"a19fc0bc8e68c94dae0f1d48ff7cef2dba8ad94d",files:bundle.length,bytes:bundle.reduce((s,x)=>s+x.bytes,0),markers:checks,voiceEvidence,launchEvidence,launchSites,hashes:bundle,limits:"Compile-only synthetic config; no APK, real auth, runtime navigation or production integration."};
writeFileSync(out,JSON.stringify(report,null,2)+"\n");
console.log("[OK] generated QA290 WebView source/bundle evidence, "+bundle.length+" files");
