// Instrument the FINAL generated QA290 Motorista sources, not the pinned
// upstream file. Never run outside the historical disposable workspace.
import {readFileSync,writeFileSync,realpathSync,mkdirSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {instrumentWebVoice} from "./instrument-web-voice.mjs";
import {instrumentVoice} from "./instrument-driver-voice.mjs";

function once(s,a,b) {
  assert.equal(s.split(a).length,2,"QA290 generated voice anchor: "+a);
  return s.replace(a,()=>b);
}
const baseSignature='export async function speak(text: string, opts?: { dedupKey?: string; interrupt?: boolean }) {';
const externalBlock='// QA235: external maps controls all guidance voice during an active ride.\n'+
 'let qa235ExternalVoice=false;\n'+
 'export function setApoisExternalNavigationOwnsVoice(value:boolean){\n'+
 ' qa235ExternalVoice=value;\n'+
 ' if(value){synth()?.cancel();if(nativeVoiceAvailable())void NativeDriverVoice.stop().catch(()=>undefined);}\n'+
 '}\n'+baseSignature+'\n if(qa235ExternalVoice)return;';
export function instrumentGeneratedWebVoice(raw) {
  // QA235 removed old maneuver calls from motorista.app.tsx. Keep its default
  // external ownership semantics; prepare the guarded handoff exports for the
  // future verified host. Do not re-enable old route speech or change prefs.
  let s=instrumentWebVoice(once(raw,externalBlock,baseSignature));
  const signature='export async function speak(text: string, opts?: { dedupKey?: string; interrupt?: boolean; guidance?: boolean }) {';
  s=once(s,signature,`// APOIS_NAVIGATION_QA290_GENERATED_VOICE_GUARD
let qa235ExternalVoice=false;
export function setApoisExternalNavigationOwnsVoice(value:boolean){
  if (qa235ExternalVoice===value) return;
  qa235ExternalVoice=value;
  voiceEpoch++;
  if(value){
    // Keep the external navigator as sole owner; invalidate pending Web
    // fallback immediately and serialize against the acknowledged native stop.
    const pending = stopVoiceForHandoff();
    ordinaryReset = pending;
    void pending.finally(() => { if (ordinaryReset === pending) ordinaryReset = null; });
  }
}
`+signature+'\n  if(qa235ExternalVoice)return;');
  s=once(s,'if (beforeReset !== voiceEpoch || !enabled','if (qa235ExternalVoice || beforeReset !== voiceEpoch || !enabled');
  s=once(s,'const current = () => enabled &&','const current = () => !qa235ExternalVoice && enabled &&');
  return s;
}
export function instrumentGeneratedJavaVoice(raw) {
  // Historical hardener changed both 900ms startup delays to 2200ms.
  // Reuse the compiled original generation guard, then restore exact package
  // and delay. No second TTS service or new plugin identifier.
  assert.equal(raw.split("2200L").length,3,"QA290 historical TTS startup delay");
  const s=instrumentVoice(raw.replaceAll("2200L","900L"));
  return once(s,"package br.com.apois.navigation.compat.lab;","package com.apois.motorista;").replaceAll("900L","2200L");
}
const root=realpathSync(process.argv[2]);
const repo=realpathSync(process.argv[3]);
const temp=realpathSync(process.env.RUNNER_TEMP);
assert.equal(root,join(temp,"apois-qa290-web/.work/partner-motorista"));
const web=join(root,"src/lib/voiceNav.ts");
const app=readFileSync(join(root,"src/routes/motorista.app.tsx"),"utf8");
assert.ok(app.includes("setApoisExternalNavigationOwnsVoice"));
assert.ok(!app.includes("tickNavigation(")&&!app.includes("void speak(firstInstruction"),"legacy maneuver calls must remain absent");
const javaRoot=join(root,"android-motorista/app/src/main/java/com/apois/motorista");
const java=join(javaRoot,"DriverVoicePlugin.java");
const rawWeb=readFileSync(web,"utf8"),rawJava=readFileSync(java,"utf8");
const patchedWeb=instrumentGeneratedWebVoice(rawWeb),patchedJava=instrumentGeneratedJavaVoice(rawJava);
assert.throws(()=>instrumentGeneratedWebVoice(patchedWeb));
assert.throws(()=>instrumentGeneratedJavaVoice(patchedJava));
assert.ok(patchedJava.includes('@CapacitorPlugin(name = "DriverVoice")'));
const generation=once(readFileSync(join(repo,"labs/apois-navigation/host-compat/VoiceGeneration.java"),"utf8"),
 "package br.com.apois.navigation.compat.lab;","package com.apois.motorista;");
writeFileSync(web,patchedWeb);
writeFileSync(java,patchedJava);
writeFileSync(join(javaRoot,"VoiceGeneration.java"),generation,{flag:"wx"});
// Test the real transformed TS with a fake Capacitor and Web Speech, not the
// production backend. Preserve offer alerts when external ownership ends.
const testRoot=join(temp,"qa290-final-voice-test");
mkdirSync(testRoot);
writeFileSync(join(testRoot,"voiceNav.ts"),once(patchedWeb,'from "@capacitor/core"','from "./capacitor-stub.mjs"'));
writeFileSync(join(testRoot,"capacitor-stub.mjs"),'export const Capacitor={isNativePlatform:()=>true,getPlatform:()=>"android"}; export const registerPlugin=()=>globalThis.__qa290Voice.plugin;');
const spoken=[];
let rejectOld;
let calls=0;
globalThis.__qa290Voice={plugin:{
  prime:async()=>({ready:true}),stop:async()=>({stopped:true}),
  speak:({text})=>{calls++; if(text==="old")return new Promise((_,reject)=>{rejectOld=reject}); spoken.push(text);return Promise.resolve({spoken:true});}
}};
globalThis.window={localStorage:{getItem:()=>null,setItem:()=>{}},speechSynthesis:{cancel(){},getVoices:()=>[],speak:()=>{throw Error("stale Web Speech");}}};
globalThis.SpeechSynthesisUtterance=class {};
const voice=await import(join(testRoot,"voiceNav.ts"));
const old=voice.speak("old");
assert.equal(calls,1);
voice.setApoisExternalNavigationOwnsVoice(true);
rejectOld(Error("late native error"));
await old;
await voice.speak("suppressed");
assert.equal(calls,1);
voice.setApoisExternalNavigationOwnsVoice(false);
// A fresh explicit handoff acknowledgement must work after the QA235 stop.
await Promise.resolve();await Promise.resolve();
assert.equal(await voice.stopVoiceForHandoff(),true);
voice.setLegacyGuidanceAllowed(false);
await voice.speak("maneuver",{guidance:true});
await voice.speak("Nova corrida");
assert.deepEqual(spoken,["Nova corrida"]);
const sha=s=>createHash("sha256").update(s).digest("hex");
console.log("[OK] QA290 final voice guard: delayed fallback blocked, operational speech retained after external release, legacy maneuver gated");
console.log("[OK] QA290 generated voice SHA256 web="+sha(patchedWeb)+" java="+sha(patchedJava)+" generation="+sha(generation));
