// Instrument the FINAL generated QA290 Motorista sources, not the pinned
// upstream file. Never run outside the historical disposable workspace.
import {readFileSync,writeFileSync,realpathSync,mkdirSync} from "node:fs";
import {join} from "node:path";
import {createHash} from "node:crypto";
import assert from "node:assert/strict";
import {instrumentWebVoice} from "./instrument-web-voice.mjs";
import {instrumentVoice} from "./instrument-driver-voice.mjs";
import {instrumentSharedAudio} from "./instrument-shared-audio.mjs";

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
// This scoped gate is not native authorization. It only prevents competing
// Web Speech while the confirmed native session may own the shared engine.
let confirmedVoiceScope: {ready:boolean} | null=null;
function confirmedSpeechAllowed(guidance?:boolean):boolean {
  return confirmedVoiceScope ? confirmedVoiceScope.ready && !guidance : !qa235ExternalVoice;
}
export async function beginConfirmedVoiceHandoff():Promise<(()=>void)|null>{
  if(confirmedVoiceScope||!nativeVoiceAvailable())return null;
  const scope={ready:false};
  confirmedVoiceScope=scope;
  voiceEpoch++;
  const release=()=>{
    if(confirmedVoiceScope!==scope)return;
    confirmedVoiceScope=null;
    voiceEpoch++;
  };
  try{
    if(ordinaryReset)await ordinaryReset;
    const stopping=stopVoiceForHandoff();
    const epoch=voiceEpoch;
    const stopped=await stopping;
    if(stopped!==true||epoch!==voiceEpoch||confirmedVoiceScope!==scope||
       synth()?.speaking===true||synth()?.pending===true){release();return null;}
    scope.ready=true;
    return release;
  }catch{release();return null;}
}
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
`+signature+'\n  if(!confirmedSpeechAllowed(opts?.guidance))return;');
  s=once(s,'if (beforeReset !== voiceEpoch || !enabled','if (!confirmedSpeechAllowed(opts?.guidance) || beforeReset !== voiceEpoch || !enabled');
  s=once(s,'const current = () => enabled &&','const current = () => confirmedSpeechAllowed(opts?.guidance) && enabled &&');
  s=once(s,"if (!current()) return;\n      console.warn(\"[APOIS VOICE] fala nativa falhou; tentando Web Speech\", error);","if (!current() || confirmedVoiceScope) return;\n      console.warn(\"[APOIS VOICE] fala nativa falhou; tentando Web Speech\", error);");
  s=once(s,"const s = synth();\n  if (!s) return;\n  await loadVoices();","if (confirmedVoiceScope) return;\n  const s = synth();\n  if (!s) return;\n  await loadVoices();");
  return s;
}
export function instrumentGeneratedJavaVoice(raw) {
  // Historical hardener changed both 900ms startup delays to 2200ms.
  // Reuse the compiled original generation guard, then restore exact package
  // and delay. No second TTS service or new plugin identifier.
  assert.equal(raw.split("2200L").length,3,"QA290 historical TTS startup delay");
  const s=instrumentSharedAudio(instrumentVoice(raw.replaceAll("2200L","900L")));
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
let stopOk=true;
const preferenceKey="apois:motorista:voice-enabled";
const migrationKey="apois:motorista:voice-guidance-v2";
const storage=new Map();
globalThis.__qa290Voice={plugin:{
  prime:async()=>({ready:true}),stop:async()=>({stopped:stopOk}),
  speak:({text})=>{calls++; if(text==="old")return new Promise((_,reject)=>{rejectOld=reject}); if(text==="falha operacional")return Promise.reject(Error("native unavailable")); spoken.push(text);return Promise.resolve({spoken:true});}
}};
globalThis.window={localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>{storage.set(key,String(value));}},speechSynthesis:{cancel(){},getVoices:()=>[],speak:()=>{throw Error("stale Web Speech");}}};
globalThis.SpeechSynthesisUtterance=class {};
const voice=await import(join(testRoot,"voiceNav.ts"));
// Historical migration intentionally initializes both distinct keys.
assert.equal(storage.get(migrationKey),"1");
assert.equal(storage.get(preferenceKey),"true");
const initialStorage=[...storage];
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
voice.setApoisExternalNavigationOwnsVoice(true);
const release=await voice.beginConfirmedVoiceHandoff();
assert.equal(typeof release,"function");
await voice.speak("manobra antiga",{guidance:true});
await voice.speak("Nova oferta");
await voice.speak("falha operacional"); // native rejection must not fall into Web Speech
assert.deepEqual(spoken,["Nova corrida","Nova oferta"]);
assert.equal(await voice.beginConfirmedVoiceHandoff(),null);
assert.deepEqual([...storage],initialStorage);
release();
await voice.speak("suprimida pelo mapa externo");
assert.deepEqual(spoken,["Nova corrida","Nova oferta"]);
stopOk=false;
assert.equal(await voice.beginConfirmedVoiceHandoff(),null);
stopOk=true;
voice.setApoisExternalNavigationOwnsVoice(false);
const recovered=await voice.beginConfirmedVoiceHandoff();
assert.equal(typeof recovered,"function");
release(); // stale release must not clear the new gate
await voice.speak("falha operacional");
voice.setVoiceEnabled(false);
await voice.speak("preferência desativada");
assert.equal(storage.get(preferenceKey),"false");
assert.equal(storage.get(migrationKey),"1");
recovered();
assert.deepEqual(spoken,["Nova corrida","Nova oferta"]);
const sha=s=>createHash("sha256").update(s).digest("hex");
console.log("[OK] QA290 final voice guard: delayed fallback blocked, operational speech retained after external release, legacy maneuver gated; confirmed scope uses native-only alerts, rejects ambiguous stop and preserves preference");
console.log("[OK] QA290 generated voice SHA256 web="+sha(patchedWeb)+" java="+sha(patchedJava)+" generation="+sha(generation));
