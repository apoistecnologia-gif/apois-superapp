import test from "node:test";
import assert from "node:assert/strict";
import {pathToFileURL} from "node:url";
import {join} from "node:path";
const root=process.env.APOIS_WEB_VOICE_TEST_DIR;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
let seq=0;
async function setup({native=true,plugin={},voices=true}={}){
 const web=[],calls=[],storage=new Map();
 const synth={getVoices:()=>voices?[{name:"local",lang:"pt-BR"}]:[],cancel:()=>calls.push("web-stop"),speak:u=>web.push(u.text),onvoiceschanged:null};
 globalThis.window={speechSynthesis:synth,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}};
 globalThis.SpeechSynthesisUtterance=class{constructor(text){this.text=text;}};
 globalThis.__voiceTest={native,plugin:{prime:async()=>{},speak:async o=>{calls.push(o.text);return {spoken:true}},stop:async()=>({stopped:true}),...plugin}};
 const mod=await import(pathToFileURL(join(root,"voiceNav.ts")).href+"?case="+(++seq));
 return {mod,web,calls,storage,synth};
}
test("late native rejection after stop cannot fall back",async()=>{
 const wait=deferred();const {mod,web}=await setup({plugin:{speak:()=>wait.promise}});
 const pending=mod.speak("manobra",{guidance:true});
 assert.equal(await mod.stopVoiceForHandoff(),true);
 wait.reject(Error("late"));await pending;assert.deepEqual(web,[]);
});
test("cancelled native callback never falls back",async()=>{
 const {mod,web}=await setup({plugin:{speak:async()=>({spoken:false,cancelled:true})}});
 await mod.speak("manobra");assert.deepEqual(web,[]);
});
test("gates guidance only without changing stored preference",async()=>{
 const {mod,calls,storage}=await setup();
 mod.setLegacyGuidanceAllowed(false);
 mod.tickNavigation({lat:-9.4,lng:-40.5},[{lat:-9.4,lng:-40.5,distanceMeters:10,instruction:"manobra"}],"ride");
 await mod.speak("Nova corrida");
 assert.deepEqual(calls,["Nova corrida"]);assert.equal(mod.isVoiceEnabled(),true);assert.equal(storage.size,0);
 mod.setLegacyGuidanceAllowed(true);
 mod.tickNavigation({lat:-9.4,lng:-40.5},[{lat:-9.4,lng:-40.5,distanceMeters:10,instruction:"manobra"}],"ride");
 await Promise.resolve();assert.deepEqual(calls,["Nova corrida","manobra"]);
});
test("while stop pending or failed no speech, explicit successful stop recovers",async()=>{
 const wait=deferred();let n=0;
 const {mod,calls}=await setup({plugin:{stop:()=>++n===1?wait.promise:Promise.resolve({stopped:true})}});
 const stop=mod.stopVoiceForHandoff();await mod.speak("blocked");
 wait.resolve({stopped:false});assert.equal(await stop,false);
 await mod.speak("blocked again");assert.equal(calls.includes("blocked again"),false);
 assert.equal(await mod.stopVoiceForHandoff(),true);await mod.speak("allowed");
 assert.equal(calls.includes("allowed"),true);
});
test("pending web voice load cannot speak after stop",async()=>{
 const {mod,web,synth}=await setup({native:false,voices:false});
 const pending=mod.speak("old");
 await mod.stopVoiceForHandoff();
 synth.onvoiceschanged();await pending;assert.deepEqual(web,[]);
});

test("ordinary reset followed immediately by operational alert waits instead of dropping it",async()=>{
 const wait=deferred();const {mod,calls}=await setup({plugin:{stop:()=>wait.promise}});
 mod.resetSpokenCache();const p=mod.speak("Chegada informada",{interrupt:true});
 assert.equal(calls.includes("Chegada informada"),false);
 wait.resolve({stopped:true});await p;assert.equal(calls.includes("Chegada informada"),true);
});
