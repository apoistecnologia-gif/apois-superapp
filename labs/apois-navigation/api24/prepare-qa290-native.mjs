import {readFileSync,writeFileSync,cpSync,mkdirSync,mkdtempSync,rmSync,realpathSync} from "node:fs";
import {createHash} from "node:crypto";
import {join,resolve} from "node:path";
import {spawnSync} from "node:child_process";
import assert from "node:assert/strict";
const [hostArg,sourceArg,repoArg]=process.argv.slice(2);
const host=realpathSync(hostArg), source=realpathSync(sourceArg), repo=realpathSync(repoArg);
const temp=realpathSync(process.env.RUNNER_TEMP);
assert.ok(host.startsWith(temp+"/") && host.endsWith("/apois-external-api24"),"disposable host required");
const pin="9fc171050d8b5703540c49d19a8f1e9f5162775f";
const git=spawnSync("git",["rev-parse","HEAD"],{cwd:source,encoding:"utf8"});
assert.equal(git.stdout.trim(),pin);
const stage=mkdtempSync(join(temp,"apois-api24-qa290-copy-"));
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
  // Rebuild the historical native chain in a disposable staging scaffold.
  let gradle=readFileSync(join(android,"app/build.gradle"),"utf8");
  assert.ok(gradle.includes("implementation project(':capacitor-android')"));
  // The first fixture already added the exact dependency; let the historical
  // installer own insertion in its staging Gradle file.
  const dep="    implementation 'com.google.android.gms:play-services-location:21.3.0'\n";
  assert.equal(gradle.split(dep).length,2);
  writeFileSync(join(android,"app/build.gradle"),gradle.replace(dep,""));
  writeFileSync(join(java,"MainActivity.java"),[
    "package br.com.apois.parceiro;",
    "public class MainActivity extends com.getcapacitor.BridgeActivity {",
    "    @Override public void onCreate(android.os.Bundle savedInstanceState) {",
    "        registerPlugin(DriverVoicePlugin.class);",
    "        super.onCreate(savedInstanceState);",
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
  const webview=spawnSync(process.execPath,[join(repo,"scripts/harden-apois-native-webview-scroll-v1.mjs"),"parceiro"],{cwd:stage,stdio:"inherit"});
  assert.equal(webview.status,0,"historical native WebView guard");
  const hash=text=>createHash("sha256").update(text).digest("hex");
  const target=join(app,"src/main/java/br/com/apois/navigation/external/lab");
  const names=["DriverLocationService.java","DriverLocationPlugin.java","CourierLocationService.java","CourierLocationPlugin.java","APOISExternalNavigationPlugin.java","APOISReturnBubble.java","MainActivity.java"];
  const fingerprints={};
  for(const name of names){
    const raw=readFileSync(join(java,name),"utf8");
    const anchor="package br.com.apois.parceiro;";
    assert.equal(raw.split(anchor).length,2,name);
    assert.ok(!/br\.com\.apois\.navigation\.lab|SharedGuidanceAudio|labGpsPublish|NativeDriverReadSource|ConfirmedLiveNavigation|ApoisNavigationLabPlugin/.test(raw),name);
    fingerprints[name]=hash(raw);
    writeFileSync(join(target,name),raw.replace(anchor,"package br.com.apois.navigation.external.lab;"));
  }
  const main=readFileSync(join(target,"MainActivity.java"),"utf8");
  for(const name of ["DriverVoicePlugin","DriverLocationPlugin","CourierLocationPlugin","APOISExternalNavigationPlugin"])
    assert.equal(main.split("registerPlugin("+name+".class)").length,2,name);
  assert.ok(main.includes("APOISReturnBubble")&&main.includes("APOIS_ANDROID_WEBVIEW_OVERSCROLL_V1"));
  const voice=readFileSync(join(target,"DriverVoicePlugin.java"),"utf8");
  assert.ok(voice.includes("2200L")&&!/SharedGuidanceAudio|VoiceGeneration/.test(voice));
  const generatedManifest=readFileSync(join(android,"app/src/main/AndroidManifest.xml"),"utf8");
  for(const marker of ['android:allowBackup="false"','android:usesCleartextTraffic="false"','android:name=".DriverLocationService"','android:name=".CourierLocationService"','android:foregroundServiceType="location"'])
    assert.ok(generatedManifest.includes(marker),marker);
  assert.ok(!/ACCESS_BACKGROUND_LOCATION|overrideLibrary|ferrostar|maplibre/i.test(generatedManifest));
  writeFileSync(join(app,"src/main/AndroidManifest.xml"),generatedManifest);
  cpSync(join(android,"app/src/main/res/drawable-nodpi/apois_return_logo.png"),join(app,"src/main/res/drawable-nodpi/apois_return_logo.png"));
  const vars=readFileSync(join(android,"variables.gradle"),"utf8");
  assert.match(vars,/minSdkVersion\s*=\s*24\b/);
  assert.equal(vars,readFileSync(join(host,"android/variables.gradle"),"utf8"));
  const generatedGradle=readFileSync(join(android,"app/build.gradle"),"utf8");
  assert.equal((generatedGradle.match(/com\.google\.android\.gms:play-services-location:21\.3\.0/g)??[]).length,1);
  assert.ok(!/ferrostar|maplibre|navigation-probe/i.test(generatedGradle));
  // Keep disposable host Gradle; only generated native source and manifest
  // are transplanted. No signing settings, real app or runtime distribution.
  console.log("APOIS_API24_QA290_NATIVE_CHAIN "+JSON.stringify({chain:[...chain,"harden-apois-native-webview-scroll-v1.mjs"],fingerprints,minSdk:24,compileOnly:true}));
} finally {rmSync(stage,{recursive:true,force:true});}
