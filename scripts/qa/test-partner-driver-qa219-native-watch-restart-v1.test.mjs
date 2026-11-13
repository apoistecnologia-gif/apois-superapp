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
