// External-only compile fixture. No production host, signing, APK or device.
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,realpathSync,mkdirSync,cpSync,existsSync} from "node:fs";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
const [hostArg,sourceArg,repoArg]=process.argv.slice(2);
const host=realpathSync(hostArg),source=realpathSync(sourceArg),repo=realpathSync(repoArg);
assert.ok(host.startsWith(realpathSync(process.env.RUNNER_TEMP)+"/")&&host.endsWith("/apois-external-api24"),"disposable external host only");
const pin="9fc171050d8b5703540c49d19a8f1e9f5162775f";
assert.equal(execFileSync("git",["-C",source,"rev-parse","HEAD"],{encoding:"utf8"}).trim(),pin);
const android=join(host,"android"),app=join(android,"app");
const get=p=>readFileSync(join(android,p),"utf8");
const vars=get("variables.gradle");
assert.match(vars,/minSdkVersion\s*=\s*24\b/);
assert.match(get("build.gradle"),/com\.android\.tools\.build:gradle:8\.13\.0/);
assert.match(get("gradle/wrapper/gradle-wrapper.properties"),/gradle-8\.14\.3-all\.zip/);
assert.match(vars,/compileSdkVersion\s*=\s*36\b/);
assert.match(vars,/targetSdkVersion\s*=\s*36\b/);
const original=join(source,"android-motorista");
assert.match(readFileSync(join(original,"variables.gradle"),"utf8"),/minSdkVersion\s*=\s*24\b/);
const originalGradle=readFileSync(join(original,"app/build.gradle"),"utf8");
assert.ok(originalGradle.includes("implementation 'com.google.android.gms:play-services-location:21.3.0'"));
const gradle=get("app/build.gradle"),settings=get("settings.gradle");
assert.ok(gradle.includes("minSdkVersion rootProject.ext.minSdkVersion"));
assert.ok(gradle.includes("dependencies {"));
assert.ok(!/ferrostar|maplibre|navigation-probe/i.test(gradle+settings));
writeFileSync(join(app,"build.gradle"),gradle.replace("dependencies {","dependencies {\n    implementation 'com.google.android.gms:play-services-location:21.3.0'"));
const pkg="br.com.apois.navigation.external.lab";
const target=join(app,"src/main/java",pkg.replaceAll(".","/"));
assert.ok(existsSync(join(target,"MainActivity.java")));
const javaRoot=join(original,"app/src/main/java/com/apois/motorista");
function transplant(text,from){
  const anchor="package "+from+";";
  assert.equal(text.split(anchor).length,2);
  return text.replace(anchor,"package "+pkg+";");
}
for(const name of ["DriverLocationPlugin.java","DriverLocationService.java","DriverVoicePlugin.java"]){
  const raw=readFileSync(join(javaRoot,name),"utf8");
  assert.ok(!/br\.com\.apois\.navigation\.lab|SharedGuidanceAudio|labGpsPublish/.test(raw),name);
  // Keep the historical native voice startup delay used by QA290.
  const content=name==="DriverVoicePlugin.java"?raw.replaceAll("900L","2200L"):raw;
  if(name==="DriverVoicePlugin.java")assert.equal(raw.split("900L").length,3);
  writeFileSync(join(target,name),transplant(content,"com.apois.motorista"),{flag:"wx"});
}
for(const name of ["APOISExternalNavigationPlugin.java","APOISReturnBubble.java"]){
  const raw=readFileSync(join(repo,"scripts/android",name),"utf8");
  writeFileSync(join(target,name),transplant(raw,"br.com.apois.parceiro"),{flag:"wx"});
}
let main=transplant(readFileSync(join(javaRoot,"MainActivity.java"),"utf8"),"com.apois.motorista");
const register="registerPlugin(DriverVoicePlugin.class);";
assert.equal(main.split(register).length,2);
main=main.replace(register,register+"\n        registerPlugin(APOISExternalNavigationPlugin.class);");
writeFileSync(join(target,"MainActivity.java"),main);
const res=join(app,"src/main/res");
mkdirSync(join(res,"drawable"),{recursive:true});
cpSync(join(original,"app/src/main/res/drawable/ic_stat_apois_notification.xml"),join(res,"drawable/ic_stat_apois_notification.xml"));
mkdirSync(join(res,"drawable-nodpi"),{recursive:true});
const logo=Buffer.from(readFileSync(join(repo,"superapp/branding/apois-client-red-logo.b64"),"utf8").trim(),"base64");
assert.equal(logo.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
writeFileSync(join(res,"drawable-nodpi/apois_return_logo.png"),logo);
const manifestPath=join(app,"src/main/AndroidManifest.xml");
let manifest=readFileSync(manifestPath,"utf8");
assert.ok(!/overrideLibrary|navigation\.lab|ferrostar|maplibre/i.test(manifest));
const packages=["com.google.android.apps.maps","com.waze","com.google.android.tts"];
const missing=packages.filter(n=>!manifest.includes('android:name="'+n+'"'));
const queries=missing.map(n=>'<package android:name="'+n+'" />').join("\n");
if(queries){
  if(manifest.includes("</queries>"))manifest=manifest.replace("</queries>",queries+"\n</queries>");
  else {assert.equal(manifest.split("</manifest>").length,2);manifest=manifest.replace("</manifest>","<queries>"+queries+"</queries>\n</manifest>");}
}
writeFileSync(manifestPath,manifest);
assert.equal(get("variables.gradle"),vars);
assert.equal(get("settings.gradle"),settings);
assert.ok(!existsSync(join(android,"navigation-probe")));
assert.ok(!/ApoisNavigationLabPlugin|ConfirmedLiveNavigation|SharedGuidanceAudio/.test(main));
console.log("[OK] API 24 compile-only external fixture; pinned original GPS/voice and original external plugin/bubble; no navigation SDK, APK or service registration in fixture manifest.");
