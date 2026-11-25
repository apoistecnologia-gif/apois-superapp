import test from "node:test";
import assert from "node:assert/strict";
import {confirmIndependentSelection} from "../../src/services/navigation/independent-selection.ts";
const ids=Array.from({length:4},(_,i)=>"00000000-0000-4000-8000-"+String(i+1).padStart(12,"0"));
const input=()=>({requestKey:ids[0],pickup:{id:ids[1],version:1},destination:{id:ids[2],version:1},confirmed:true});
const response=()=>({selectionId:ids[3],requestKey:ids[0],expiresAt:new Date(200000).toISOString(),origin:{lat:-9.4,lng:-40.5,label:"A"},destination:{lat:-9.42,lng:-40.51,label:"B"}});
test("explicit independent selection sends only references and snapshots response",async()=>{
  const result=await confirmIndependentSelection(input(),async body=>{assert.deepEqual(body,input());return response();},undefined,()=>100000);
  assert.equal(result?.selectionId,ids[3]);assert.equal(result?.destination.lat,-9.42);assert.ok(Object.isFrozen(result?.destination));
});
test("rejects client coordinates, forged source, missing confirmation and same point",async()=>{
  let calls=0;const transport=async()=>{calls++;return response();};
  for(const v of [{...input(),source:"INDEPENDENT_OSM"},{...input(),confirmed:false},{...input(),pickup:{...input().pickup,lat:-9.4}},{...input(),destination:input().pickup}])
    assert.equal(await confirmIndependentSelection(v,transport,undefined,()=>100000),null);
  assert.equal(calls,0);
});
test("rejects stale, mismatched, malformed and cancelled response",async()=>{
  for(const p of [{requestKey:ids[1]},{expiresAt:new Date(99999).toISOString()},{expiresAt:new Date(500001).toISOString()},{origin:{...response().origin,lng:0}},{source:"GOOGLE"}])
    assert.equal(await confirmIndependentSelection(input(),async()=>({...response(),...p}),undefined,()=>100000),null);
  const c=new AbortController();
  assert.equal(await confirmIndependentSelection(input(),async()=>{c.abort();return response();},c.signal,()=>100000),null);
});
