import {readFileSync,writeFileSync,cpSync,mkdirSync,mkdtempSync,rmSync,realpathSync} from "node:fs";
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
  writeFileSync(join(java,"MainActivity.java"),"        registerPlugin(DriverVoicePlugin.class);\n");
  const install=spawnSync(process.execPath,[join(repo,"scripts/install-motorista-qa290-driver-location.mjs")],{cwd:stage,stdio:"inherit"});
  assert.equal(install.status,0,"QA290 installer failed");
  const original=readFileSync(join(java,"DriverLocationService.java"),"utf8");
  const patched=instrumentDriverService(original);
  // Also check the exact QA235 insertion point, without pretending the full
  // QA235/QA236/QA239 production chain was built in this disposable host.
  const shaped=original.replace("                queuePresenceSync(true, location);","                queuePresenceSync(true, location);\n                qa235CheckPickupArrival(location);");
  assert.ok(instrumentDriverService(shaped).includes("qa235CheckPickupArrival(location);\n                labGpsPublish(location);"));
  assert.throws(()=>instrumentDriverService(patched));
  assert.throws(()=>instrumentDriverService(original.replace("        startLocationUpdates();","")));
  assert.equal(original.split("requestLocationUpdates(").length,patched.split("requestLocationUpdates(").length);
  const target=join(app,"src/main/java/br/com/apois/navigation/compat/lab/DriverLocationService.java");
  writeFileSync(target,patched.replace("package br.com.apois.parceiro;","package br.com.apois.navigation.compat.lab;"));
  mkdirSync(join(app,"src/main/res/drawable"),{recursive:true});
  cpSync(join(src,"res/drawable/ic_stat_apois_notification.xml"),join(app,"src/main/res/drawable/ic_stat_apois_notification.xml"));
  const hostGradle=join(app,"build.gradle");
  writeFileSync(hostGradle,readFileSync(hostGradle,"utf8").replace("dependencies {","dependencies {\n    implementation 'com.google.android.gms:play-services-location:21.3.0'"));
  assert.ok(!readFileSync(join(app,"src/main/AndroidManifest.xml"),"utf8").includes("DriverLocationService"),"service must remain unregistered");
  console.log("[OK] real pinned source + actual QA290 installer + passive callback, no manifest service, no additional GPS request");
} finally {rmSync(stage,{recursive:true,force:true});}
