// Offline test: recover from Photon transient failures without extra Google billing,
// while never retrying 403/429 or exposing destination text in error messages.
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";

const src=readFileSync(resolve("supabase/functions/google-maps-address/index.ts"),"utf8");
const start=src.indexOf("async function fetchPhotonSearchJson(url: URL) {");
const end=src.indexOf("\nasync function nominatimSearch(",start);
assert.ok(start>=0 && end>start,"Photon autocomplete helper must be declared before the search routine");
const extracted=src.slice(start,end).replace("url: URL","url");
assert.ok(extracted.includes("attempt < 2"),"Retry count must be bounded");
assert.ok(extracted.includes("response.status === 429 || response.status === 403"),"Provider limits must fail closed");
assert.ok(extracted.includes("new AbortController()"),"Photon calls must have timeout");
assert.ok(src.includes("const payload = await fetchPhotonSearchJson(url);"),"Autocomplete must actually use helper");
assert.ok(src.includes("Photon autocomplete unavailable after bounded retry"),"Failure must be diagnosed without user address");
assert.ok(src.includes('return json({ error: "Serviço de sugestões temporariamente indisponível. Tente novamente." }, 503);'),"Unavailability must have explicit status");
assert.ok(src.includes('url.searchParams.set("limit", "8")'),"Bound autocomplete search result count");
assert.ok(!src.includes("console.error(input)"),"Never log passenger destination input");

const endpoint = new URL("https://photon.komoot.io/api/?q=teste");
function helper(fetchStub) {
  // Build only the extracted pure async helper; no Supabase, Google or external network.
  return new Function("fetch","AbortController","photonHeaders","setTimeout","clearTimeout",
    extracted+"\nreturn fetchPhotonSearchJson;"
  )(fetchStub,AbortController,{Accept:"application/json"},setTimeout,clearTimeout);
}
const response = (status,payload={features:[{properties:{name:"Teste"}}]})=>({
  status,ok:status>=200&&status<300,json:async()=>payload,
});

test("success with no retry",async()=>{
  let calls=0;
  const fn=helper(async()=>{calls++;return response(200);});
  const data=await fn(endpoint);
  assert.equal(calls,1);
  assert.equal(data.features[0].properties.name,"Teste");
});
test("transient connection issue retries once",async()=>{
  let calls=0;
  const fn=helper(async()=>{calls++;if(calls===1)throw Error("ECONNREFUSED");return response(200);});
  await fn(endpoint);
  assert.equal(calls,2);
});
test("HTTP 500 retries once",async()=>{
  let calls=0;
  const fn=helper(async()=>{calls++;return response(calls===1?500:200);});
  await fn(endpoint);
  assert.equal(calls,2);
});
for(const status of [403,429,400]){
  test("HTTP "+status+" is never retried",async()=>{
    let calls=0;
    const fn=helper(async()=>{calls++;return response(status);});
    await assert.rejects(()=>fn(endpoint),/Photon autocomplete/);
    assert.equal(calls,1);
  });
}
test("repeated provider failure never loops forever",async()=>{
  let calls=0;
  const fn=helper(async()=>{calls++;throw Error("network unavailable");});
  await assert.rejects(()=>fn(endpoint),/Photon autocomplete temporarily unavailable/);
  assert.equal(calls,2);
});
