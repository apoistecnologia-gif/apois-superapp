import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { patchNativeWatchRestart, marker } from "../fix-partner-driver-qa219-native-watch-restart-v1.mjs";

// Test the actual source injected by the legacy hardener, not a hand-written
// approximation of the Capacitor callback.
const upstream = readFileSync(resolve(process.cwd(),"scripts/harden-partner-motorista-native-watch.mjs"),"utf8");
const match = upstream.match(/const newWatch = `([\s\S]*?)`;/);
assert.ok(match?.[1], "upstream native watch template must exist");
const baseline = "  const watchStopRequestedRef = useRef(false);\n" + match[1];

test("retains one native watch and a deferred restart after the obsolete start closes",()=>{
 const src=patchNativeWatchRestart(baseline);
 assert.ok(src.includes(marker));
 assert.ok(src.includes("watchRestartRequestedRef.current = false;\n    watchStopRequestedRef.current = true;"),"offline cancels pending restart");
 assert.ok(src.includes("if (watchStopRequestedRef.current) watchRestartRequestedRef.current = true;"),"online remembers restart while previous watch is in flight");
 assert.ok(src.includes("Geolocation.clearWatch({ id }).catch(() => undefined).finally"),"old native watch must be closed before restart");
 assert.ok(src.includes("watchRestartRequestedRef.current = false;\n            startWatch();"),"pending watch restarts once");
 assert.ok(src.includes("if (watchRestartRequestedRef.current) {\n          watchRestartRequestedRef.current = false;\n          startWatch();"),"failed obsolete startup also restarts");
 assert.ok(src.includes("watchIdRef.current = navigator.geolocation.watchPosition("),"web GPS fallback kept");
 assert.equal((src.match(/watchRestartRequestedRef = useRef\(false\)/g)||[]).length,1);
});

test("refuses duplicate transform and fails closed if upstream start contract changes",()=>{
 const src=patchNativeWatchRestart(baseline);
 assert.throws(()=>patchNativeWatchRestart(src),/already patched/);
 assert.throws(()=>patchNativeWatchRestart(baseline.replace("watchStopRequestedRef = useRef(false)","watchStopRequestedRef = useRef(true)")),/refs changed/);
 assert.throws(()=>patchNativeWatchRestart(baseline.replace("watchIdRef.current != null || watchStartingRef.current","watchIdRef.current != null")),/start during pending stop/);
});

test("generated Motorista has the race guard without altering published modules",()=>{
 const path=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista","src/routes/motorista.app.tsx");
 if(!existsSync(path))return;
 const source=readFileSync(path,"utf8");
 for(const text of [marker,"const stopDriverWatch = useCallback","Geolocation.watchPosition","watchRestartRequestedRef.current = true","watchRestartRequestedRef.current = false","clearWatch({ id }).catch(() => undefined).finally"])
  assert.ok(source.includes(text),text);
});


function nativeWatchHarness() {
  const patched = patchNativeWatchRestart(baseline)
    .replace(/const applyCoords = \(coords: \{[\s\S]*?\}\) => \{/, 'const applyCoords = (coords) => {')
    .replaceAll(' as number', '')
    .replaceAll('import.meta.env.DEV', 'false');
  const code = [
    'const useRef=(v)=>({current:v}), useCallback=(callback)=>callback;',
    'const watchIdRef={current:null}, watchStartingRef={current:false};',
    'const pending=[], cleared=[];',
    'const Geolocation={',
    '  watchPosition:(options,callback)=>new Promise((resolve,reject)=>{pending.push({resolve,reject,callback});}),',
    '  clearWatch:({id})=>{cleared.push(id);return Promise.resolve();}',
    '};',
    'const navigator={geolocation:{clearWatch:()=>{}}};',
    'const isNativeDriverAndroid=()=>true, isBrazilCoordinate=()=>true;',
    'const positions=[];let latestPosition=null;',
    'const setPosition=(value)=>{latestPosition=typeof value==="function"?value(latestPosition):value;positions.push(latestPosition);};',
    patched,
    'return {startWatch,stopDriverWatch,pending,cleared,positions,watchIdRef,watchStartingRef,watchRestartRequestedRef};'
  ].join('\n');
  return new Function(code)();
}
async function flushNativeCallbacks() {
  for(let i=0;i<10;i+=1) await Promise.resolve();
}
test("real async: rapid ONLINE/OFFLINE/ONLINE closes obsolete GPS watch then starts exactly one replacement",async()=>{
  const m=nativeWatchHarness();
  m.startWatch();
  m.stopDriverWatch();
  m.startWatch();
  assert.equal(m.pending.length,1,"only first native start pending");
  m.pending[0].resolve("old-id");
  await flushNativeCallbacks();
  assert.deepEqual(m.cleared,["old-id"]);
  assert.equal(m.pending.length,2,"one replacement created after the old was closed");
  m.pending[1].resolve("new-id");
  await flushNativeCallbacks();
  assert.equal(m.watchIdRef.current,"new-id");
  assert.equal(m.watchStartingRef.current,false);
});
test("real async: latest OFFLINE wins and cancels a previously requested GPS restart",async()=>{
  const m=nativeWatchHarness();
  m.startWatch();
  m.stopDriverWatch();
  m.startWatch();
  m.stopDriverWatch();
  m.pending[0].resolve("old-id");
  await flushNativeCallbacks();
  assert.deepEqual(m.cleared,["old-id"]);
  assert.equal(m.pending.length,1,"must not restart after a newer OFFLINE");
  assert.equal(m.watchIdRef.current,null);
});
test("real async: rejected obsolete GPS startup retries once for the newer ONLINE cycle",async()=>{
  const m=nativeWatchHarness();
  m.startWatch();
  m.stopDriverWatch();
  m.startWatch();
  m.pending[0].reject(new Error("initial GPS unavailable"));
  await flushNativeCallbacks();
  assert.equal(m.pending.length,2,"retry only the newer online cycle");
  m.pending[1].resolve("second-id");
  await flushNativeCallbacks();
  assert.equal(m.watchIdRef.current,"second-id");
});


test("real async: GPS callback after going OFFLINE does not replace last position",async()=>{
  const m=nativeWatchHarness();
  m.startWatch();
  const location=(latitude)=>({coords:{latitude,longitude:-40.5,heading:null,speed:null,accuracy:20}});
  m.pending[0].callback(location(-9.4),null);
  assert.equal(m.positions.length,1,"valid ONLINE GPS is consumed");
  m.stopDriverWatch();
  m.pending[0].callback(location(-9.5),null);
  assert.equal(m.positions.length,1,"obsolete watcher must not update position after OFFLINE");
  m.pending[0].resolve("stopped-watch");
  await flushNativeCallbacks();
  assert.deepEqual(m.cleared,["stopped-watch"]);
});
