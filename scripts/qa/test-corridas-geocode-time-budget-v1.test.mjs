// APOIS_CORRIDAS_REVERSE_LATENCY_QA_V1
// Isolated tests of the exact deployed Edge Function helpers. No network,
// credentials, paid Maps requests, Supabase mutations, or user coordinates.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const src = readFileSync("supabase/functions/google-maps-address/index.ts", "utf8");
const between = (start, end) => {
  const a = src.indexOf(start);
  const b = a < 0 ? -1 : src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "Missing tested function: " + start);
  return src.slice(a, b);
};
const fakeTimers = () => {
  const scheduled = [];
  return {
    scheduled,
    setTimeout: (callback, milliseconds) => {
      scheduled.push(milliseconds);
      return globalThis.setTimeout(callback, 4);
    },
    clearTimeout: (id) => globalThis.clearTimeout(id),
  };
};
const makePendingFetch = () => {
  let calls = 0;
  const fetch = (_url, options = {}) => {
    calls++;
    return new Promise((_resolve, reject) => {
      if (!options.signal) return reject(new Error("Missing cancellation signal"));
      options.signal.addEventListener("abort", () => reject(
        Object.assign(new Error("aborted"), {name: "AbortError"})
      ), {once: true});
    });
  };
  return {fetch, get calls() {return calls;}};
};
const googleCode = between("const GOOGLE_LOOKUP_TIMEOUT_MS = 2400;", "\nfunction toGoogleLikeComponents(")
  .replace("url: URL", "url");
function googleHelper(fakeFetch, timers) {
  return new Function("fetch", "AbortController", "setTimeout", "clearTimeout",
    googleCode + "\nreturn {googleJson, GOOGLE_LOOKUP_TIMEOUT_MS};"
  )(fakeFetch, AbortController, timers.setTimeout, timers.clearTimeout);
}
const photonCode = between("async function fetchPhotonReverseJson(url: URL) {", "\nasync function nominatimReverse(")
  .replace("url: URL", "url");
function photonHelper(fakeFetch, timers) {
  return new Function("fetch", "AbortController", "setTimeout", "clearTimeout", "photonHeaders",
    photonCode + "\nreturn fetchPhotonReverseJson;"
  )(fakeFetch, AbortController, timers.setTimeout, timers.clearTimeout, {Accept:"application/json"});
}

test("Reverse-specific Google timeout cancels hung requests and continues to fallback", async () => {
  const pending = makePendingFetch();
  const timers = fakeTimers();
  const {googleJson, GOOGLE_LOOKUP_TIMEOUT_MS} = googleHelper(pending.fetch, timers);
  await assert.rejects(googleJson(new URL("https://maps.googleapis.com/maps/api/geocode/json"), GOOGLE_LOOKUP_TIMEOUT_MS), /aborted/);
  assert.equal(pending.calls, 1);
  assert.ok(timers.scheduled.includes(2400));
});

test("Other Google features preserve original unbounded lookup behavior", async () => {
  const timers = fakeTimers();
  let called = 0;
  const {googleJson} = googleHelper(async()=>{called++;return {
    ok:true,status:200,json:async()=>({status:"OK",predictions:[{description:"endereco"}]})
  }}, timers);
  const result = await googleJson(new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json"));
  assert.equal(result.predictions.length, 1);
  assert.equal(called, 1);
  assert.equal(timers.scheduled.length, 0);
  const reverse = between('if (action === "reverse_geocode") {', 'if (action === "autocomplete") {');
  const auto = between('if (action === "autocomplete") {', 'if (action === "place_details") {');
  const details = src.slice(src.indexOf('if (action === "place_details") {'));
  assert.ok(reverse.includes('googleJson(url, GOOGLE_LOOKUP_TIMEOUT_MS)'));
  assert.ok(auto.includes('googleJson(url);'));
  assert.ok(details.includes('googleJson(url);'));
});

test("Photon reverse transport cannot block the passenger screen for 50 seconds", async () => {
  const pending = makePendingFetch();
  const timers = fakeTimers();
  const fn = photonHelper(pending.fetch, timers);
  await assert.rejects(fn(new URL("https://photon.komoot.io/reverse")), /transport unavailable/);
  assert.equal(pending.calls, 2);
  assert.equal(timers.scheduled.filter(ms=>ms===3000).length, 2);
  assert.ok(2400 + 3000*2 + 250 < 12000);
});

test("Photon reverse retries transient 503 once but never retries 429 or 403", async () => {
  const timers = fakeTimers();
  let count=0;
  const recovered = photonHelper(async()=>{count++;return {
    status: count===1?503:200, ok: count===2, json:async()=>({features:[]}),
  }},timers);
  assert.deepEqual(await recovered(new URL("https://photon.komoot.io/reverse")), {features:[]});
  assert.equal(count,2);
  for (const status of [429,403]){
    let calls=0;
    const restricted = photonHelper(async()=>{calls++;return {status,ok:false};},fakeTimers());
    await assert.rejects(restricted(new URL("https://photon.komoot.io/reverse")),/temporarily restricted/);
    assert.equal(calls,1);
  }
});

test("No unauthenticated access, rate limit bypass or new provider",()=>{
  assert.ok(src.includes("consume_google_maps_lookup_quota"));
  assert.ok(src.includes('req.method !== "POST"'));
  assert.ok(src.includes('const quota = await consumeLookupQuota(req)'));
  assert.ok(src.includes('if (!quota.allowed) return json('));
  assert.ok(src.includes('const photonHeaders = { Accept: "application/json" }'));
  assert.equal((src.match(/googleJson\(url, GOOGLE_LOOKUP_TIMEOUT_MS\)/g)||[]).length,1);
});


test("Server geocoding key recognizes either established Corridas secret name",()=>{
  const start=src.indexOf("    const apiKey =\\n");
  const end=src.indexOf('\\n\\n    if (action === "reverse_geocode") {',start);
  assert.ok(start>=0 && end>start, "key lookup location must remain stable");
  const snippet=src.slice(start,end);
  assert.ok(snippet.includes('Deno.env.get("GOOGLE_MAPS_PLATFORM_API_KEY")'));
  assert.ok(snippet.includes('Deno.env.get("GOOGLE_MAPS_API_KEY")'));
  assert.ok(!snippet.includes("CORRIDAS_WEB_MAPS_API_KEY"));
  const resolve = values => new Function("Deno",snippet+"\\nreturn apiKey;")({
    env:{get:key=>values[key]??undefined}
  });
  assert.equal(resolve({GOOGLE_MAPS_PLATFORM_API_KEY:"platform-server"}),"platform-server");
  assert.equal(resolve({GOOGLE_MAPS_API_KEY:"legacy-server"}),"legacy-server");
  assert.equal(resolve({GOOGLE_MAPS_API_KEY:"legacy-server",GOOGLE_MAPS_PLATFORM_API_KEY:"platform-server"}),"legacy-server");
  assert.equal(resolve({}),undefined);
  assert.ok(src.includes('if (!apiKey) console.warn("APOIS Corridas reverse geocoding: no server-side Google key configured")'));
});
