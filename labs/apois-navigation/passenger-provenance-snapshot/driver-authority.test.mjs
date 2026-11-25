import test from "node:test";
import assert from "node:assert/strict";
import {createDriverAuthority} from "./driver-authority.mjs";
const a="00000000-0000-4000-8000-000000000061",b="00000000-0000-4000-8000-000000000062",rideId="00000000-0000-4000-8000-000000000041";
const request={rideId,phase:"PICKUP"};
const proof={authUserId:a,rideId,targetEvidence:{phase:"PICKUP"}};
test("authentication determines private query identity; no client IDs",async()=>{
  const read=createDriverAuthority({verifySession:async s=>{assert.equal(s,"fixture-token");return a;},
    readDriverProof:async q=>{assert.deepEqual(q,{authUserId:a,...request});assert.ok(Object.isFrozen(q));return proof;}});
  assert.equal(await read("fixture-token",request,new AbortController().signal),proof);
  assert.equal(await read("fixture-token",{...request,authUserId:b},new AbortController().signal),null);
});
test("invalid or absent session never reaches the SQL adapter",async()=>{
  let calls=0;
  const read=createDriverAuthority({verifySession:async()=>null,readDriverProof:async()=>{calls++;return proof;}});
  for(const s of [null,"","Bearer token",{}, "x".repeat(8193),"invalid-token"])
    assert.equal(await read(s,request,new AbortController().signal),null);
  assert.equal(calls,0);
});
test("identity, ride and phase mismatch reject proof",async()=>{
  for(const p of [{...proof,authUserId:b},{...proof,rideId:b},{...proof,targetEvidence:{phase:"TRIP"}},null]){
    const read=createDriverAuthority({verifySession:async()=>a,readDriverProof:async()=>p});
    assert.equal(await read("fixture-token",request,new AbortController().signal),null);
  }
});
test("cancellation after session verification skips SQL; cancellation after SQL denies proof",async()=>{
  const c=new AbortController();let calls=0;
  const read=createDriverAuthority({verifySession:async()=>{c.abort();return a;},readDriverProof:async()=>{calls++;return proof;}});
  assert.equal(await read("fixture-token",request,c.signal),null);assert.equal(calls,0);
  const d=new AbortController();
  const read2=createDriverAuthority({verifySession:async()=>a,readDriverProof:async()=>{d.abort();return proof;}});
  assert.equal(await read2("fixture-token",request,d.signal),null);
});
