import {readFileSync,writeFileSync,cpSync,mkdirSync,mkdtempSync,rmSync,realpathSync} from "node:fs";
import {createHash} from "node:crypto";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import assert from "node:assert/strict";
import {instrumentDriverService} from "./instrument-driver-gps.mjs";
const [hostArg,sourceArg,repoArg]=process.argv.slice(2);
const host=realpathSync(hostArg), source=realpathSync(sourceArg), repo=realpathSync(repoArg);
const temp=realpathSync(process.env.RUNNER_TEMP);
assert.ok(host.startsWith(temp+"/") && host.endsWith("/apois-compat-host"),"disposable host required");
const pin="9fc171050d8b5703540c49d19a8f1e9f5162775f";
const git=spawnSync("git",["rev-parse","HEAD"],{cwd:source,encoding:"utf8"});
assert.equal(git.stdout.trim(),pin);
const stage=mkdtempSync(join(temp,"apois-gps-copy-"));
try {
  const src=join(source,"android-motorista/app/src/main");
  const dst=join(stage,"sources/apois-corridas-motorista-admin/android-motorista/app/src/main");
  for(const file of ["java/com/apois/motorista/DriverLocationPlugin.java","java/com/apois/motorista/DriverLocationService.java","res/drawable/ic_stat_apois_notification.xml"]){
    mkdirSync(join(dst,file,".."),{recursive:true});cpSync(join(src,file),join(dst,file));
  }
  const android=join(stage,"superapp/partner-shell/android");
  const java=join(android,"app/src/main/java/br/com/apois/parceiro");
  mkdirSync(java,{recursive:true});
  const app=join(host,"android/app");
  cpSync(join(app,"src/main/AndroidManifest.xml"),join(android,"app/src/main/AndroidManifest.xml"));
  cpSync(join(app,"build.gradle"),join(android,"app/build.gradle"));
  // Installer requires these anchors; this scaffold is never compiled or registered.
  let gradle=readFileSync(join(android,"app/build.gradle"),"utf8");
  assert.ok(gradle.includes("implementation project(':capacitor-android')"));
  writeFileSync(join(android,"app/build.gradle"),gradle);
  writeFileSync(join(java,"MainActivity.java"),[
    "package br.com.apois.parceiro;",
    "public class MainActivity extends com.getcapacitor.BridgeActivity {",
    "    @Override public void onCreate(android.os.Bundle state) {",
    "        registerPlugin(DriverVoicePlugin.class);",
    "        super.onCreate(state);",
    "    }",
    "}",
    ""
  ].join("\n"));
  // Provide the launcher prerequisite package-visibility block only in the
  // temporary scaffold. No Firebase config or production signing credentials.
  const manifestPath=join(android,"app/src/main/AndroidManifest.xml");
  let xml=readFileSync(manifestPath,"utf8");
  if(!xml.includes("</queries>")) {
    assert.ok(xml.includes("</manifest>"));
    xml=xml.replace("</manifest>","    <queries><package android:name=\"com.google.android.tts\" /></queries>\n</manifest>");
    writeFileSync(manifestPath,xml);
  }
  cpSync(join(host,"android/variables.gradle"),join(android,"variables.gradle"));
  for(const file of ["scripts/android/APOISExternalNavigationPlugin.java","scripts/android/APOISReturnBubble.java","superapp/branding/apois-client-red-logo.b64"]){
    mkdirSync(join(stage,file,".."),{recursive:true});
    cpSync(join(repo,file),join(stage,file));
  }
  const chain=[
    "harden-partner-android-security.mjs",
    "install-motorista-qa290-driver-location.mjs",
    "install-partner-courier-location.mjs",
    "harden-partner-location-startup-ack.mjs",
    "harden-partner-location-session-sync.mjs",
    "harden-partner-location-notification-routing.mjs",
    "install-partner-external-navigation.mjs",
    "install-partner-qa235-native-auto-arrival.mjs",
    "install-partner-qa236-return-notification-v1.mjs",
    "install-partner-qa239-native-bubble.mjs",
    "install-partner-native-qa280.mjs"
  ];
  // Validate the actual installer ordering against the canonical launcher.
  const launcher=readFileSync(join(repo,"scripts/install-motorista-qa290-launcher.mjs"),"utf8");
  let previous=-1;
  for(const name of chain){
    const index=launcher.indexOf("'./"+name+"'");
    assert.ok(index>previous,"QA290 launcher order changed: "+name);previous=index;
    const run=spawnSync(process.execPath,[join(repo,"scripts",name)],{
      cwd:stage,stdio:"inherit",env:{...process.env,PARTNER_VERSION_CODE:"1",PARTNER_VERSION_NAME:"0.0.1-lab"}
    });
    assert.equal(run.status,0,"QA290 chain failed: "+name);
  }
  const hash=file=>createHash("sha256").update(readFileSync(file)).digest("hex");
  const shared=["CourierLocationService.java","CourierLocationPlugin.java","APOISExternalNavigationPlugin.java","APOISReturnBubble.java","DriverLocationPlugin.java"];
  const before=Object.fromEntries(shared.map(name=>[name,hash(join(java,name))]));
  const original=readFileSync(join(java,"DriverLocationService.java"),"utf8");
  assert.ok(original.includes("qa235CheckPickupArrival(location);"));
  const patched=instrumentDriverService(original);
  assert.ok(patched.includes("qa235CheckPickupArrival(location);\n                labGpsPublish(location);"));
  assert.ok(patched.includes("if (!br.com.apois.navigation.lab.NativeDriverReadSource.INSTANCE.bind("),"rejected bind must clean up GPS epoch");
  assert.ok(patched.includes("catch (RuntimeException | LinkageError ignored) { labGpsEnd(); }"),"failed bind must clean up");
  assert.match(patched,/unbind\(old\);[\s\S]*?catch \(RuntimeException \| LinkageError ignored\) \{ \}[\s\S]*?try \{ br\.com\.apois\.navigation\.lab\.DriverGpsFeed\.endSource\(old\); \}/,"GPS epoch cleanup independent from read adapter");
  for(const marker of ["qa236PickupReady","/rest/v1/rpc/driver_mark_arrived","private void loadPersistedSessionTokens()","INICIAR CORRIDA • PIN","driver_set_presence","ContextCompat.RECEIVER_NOT_EXPORTED"])
    assert.ok(patched.includes(marker),"lost QA290 marker "+marker);
  // Compare shared components untouched by the passive driver instrumentation.
  for(const name of shared)assert.equal(hash(join(java,name)),before[name],name);
  writeFileSync(join(java,"DriverLocationService.java"),patched);
  const recheck=spawnSync(process.execPath,[join(repo,"scripts/install-partner-native-qa280.mjs")],{cwd:stage,stdio:"inherit"});
  assert.equal(recheck.status,0,"QA280 post-instrumentation gate failed");
  assert.throws(()=>instrumentDriverService(patched));
  assert.throws(()=>instrumentDriverService(original.replace("        startLocationUpdates();","")));
  assert.equal(original.split("requestLocationUpdates(").length,patched.split("requestLocationUpdates(").length);
  // Compile all real generated native components, but don't copy the scaffold
  // MainActivity or manifest registrations to the actual disposable host.
  const target=join(app,"src/main/java/br/com/apois/navigation/compat/lab");
  for(const name of ["DriverLocationService.java",...shared]){
    const code=readFileSync(join(java,name),"utf8");
    assert.ok(code.includes("package br.com.apois.parceiro;"),name);
    writeFileSync(join(target,name),code.replace("package br.com.apois.parceiro;","package br.com.apois.navigation.compat.lab;"));
  }
  // Stage the actual QA290-generated Activity for an independent compile
  // proof. Do not replace the lab MainActivity or register the service.
  const candidateMain=readFileSync(join(java,"MainActivity.java"),"utf8");
  for(const marker of ["registerPlugin(DriverVoicePlugin.class)","registerPlugin(DriverLocationPlugin.class)",
      "registerPlugin(CourierLocationPlugin.class)","registerPlugin(APOISExternalNavigationPlugin.class)",
      "APOISReturnBubble.show","APOISReturnBubble.externalNavigationClosed"])
    assert.ok(candidateMain.includes(marker),"generated QA290 activity lost "+marker);
  writeFileSync(join(target,"Qa290GeneratedCandidateActivity.java"),
    candidateMain.replace("package br.com.apois.parceiro;","package br.com.apois.navigation.compat.lab;\nimport com.apois.motorista.DriverVoicePlugin;")
      .replace("public class MainActivity extends","public class Qa290GeneratedCandidateActivity extends"),{flag:"wx"});
  mkdirSync(join(app,"src/main/res/drawable"),{recursive:true});
  mkdirSync(join(app,"src/main/res/drawable-nodpi"),{recursive:true});
  cpSync(join(src,"res/drawable/ic_stat_apois_notification.xml"),join(app,"src/main/res/drawable/ic_stat_apois_notification.xml"));
  cpSync(join(android,"app/src/main/res/drawable-nodpi/apois_return_logo.png"),join(app,"src/main/res/drawable-nodpi/apois_return_logo.png"));
  const hostGradle=join(app,"build.gradle");
  writeFileSync(hostGradle,readFileSync(hostGradle,"utf8").replace("dependencies {","dependencies {\n    implementation 'com.google.android.gms:play-services-location:21.3.0'"));
  assert.ok(!readFileSync(join(app,"src/main/AndroidManifest.xml"),"utf8").includes("DriverLocationService"),"service must remain unregistered");
  const liveMain=readFileSync(join(target,"MainActivity.java"),"utf8");
  for(const name of ["DriverLocationPlugin","CourierLocationPlugin","APOISExternalNavigationPlugin"])
    assert.ok(!liveMain.includes("registerPlugin("+name+".class)"),"runtime must remain unregistered");
  console.log("[OK] actual QA290 native GPS chain through QA280; passive callback after arrival; shared files unchanged by instrumentation; no registration or additional GPS request");
} finally {rmSync(stage,{recursive:true,force:true});}
