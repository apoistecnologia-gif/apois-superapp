import test from "node:test";
import assert from "node:assert/strict";
import {createSupabaseSessionVerifier} from "./supabase-session.mjs";
const projectUrl="https://abcdefghijklmnopqrst.supabase.co",publishableKey="sb_publishable_fixture_only_123";
const sub="00000000-0000-4000-8000-000000000061",session_id="00000000-0000-4000-8000-000000000081";
const jwt=(patch={})=>["e30",Buffer.from(JSON.stringify({iss:projectUrl+"/auth/v1",aud:"authenticated",role:"authenticated",sub,session_id,iat:90,exp:200,...patch})).toString("base64url"),"fixture-signature"].join(".");
const response=(body={id:sub})=>new Response(JSON.stringify(body),{headers:{"content-type":"application/json"}});
const fixture=patch=>createSupabaseSessionVerifier({projectUrl,publishableKey,now:()=>100000,fetchImpl:async()=>response(),sessionExists:async()=>true,...patch});
const signal=()=>new AbortController().signal;
test("verified user plus current session bound to exact project",async()=>{
  const token=jwt();
  const verify=fixture({fetchImpl:async(url,o)=>{assert.equal(url,projectUrl+"/auth/v1/user");assert.equal(o.headers.Authorization,"Bearer "+token);assert.equal(o.headers.apikey,publishableKey);assert.equal(o.redirect,"error");return response();},
    sessionExists:async(q)=>{assert.deepEqual(q,{authUserId:sub,sessionId:session_id});return true;}});
  assert.equal(await verify(token,signal()),sub);
});
test("reject invalid local token claims without network; server still validates signature",async()=>{
  let calls=0;const verify=fixture({fetchImpl:async()=>{calls++;return response();}});
  for(const v of ["bad",jwt({exp:100}),jwt({iss:"https://other.invalid"}),jwt({session_id:null}),jwt({role:"service_role"}),jwt({is_anonymous:true}),jwt({aud:"anon"})])
    assert.equal(await verify(v,signal()),null);
  assert.equal(calls,0);
});
test("Auth rejection, mismatched identity, deleted session and invalid session response deny",async()=>{
  for(const p of [{fetchImpl:async()=>new Response(null,{status:401})},{fetchImpl:async()=>response({id:session_id})},{sessionExists:async()=>false},{sessionExists:async()=>({active:true})}])
    assert.equal(await fixture(p)(jwt(),signal()),null);
});
test("network, redirect, oversized or malformed response fail closed without secret error",async()=>{
  for(const p of [{fetchImpl:async()=>{throw Error("private-token");}},{fetchImpl:async()=>new Response(null,{status:302})},{fetchImpl:async()=>response({id:sub,data:"a".repeat(70000)})},{fetchImpl:async()=>new Response("not-json",{headers:{"content-type":"application/json"}})},{sessionExists:async()=>{throw Error("private-db");}}])
    await assert.rejects(fixture(p)(jwt(),signal()),{message:"Session verification unavailable"});
});
test("cancelled or expired during verification cannot authenticate",async()=>{
  let t=100000;const verify=fixture({now:()=>t,sessionExists:async()=>{t=200000;return true;}});
  assert.equal(await verify(jwt(),signal()),null);
  const c=new AbortController();
  await assert.rejects(fixture({sessionExists:async()=>{c.abort();return true;}})(jwt(),c.signal),{message:"Session verification unavailable"});
  assert.equal(await fixture()(jwt(),c.signal),null);
});
test("configuration refuses arbitrary endpoints and privileged keys",()=>{
  for(const p of [{projectUrl:"http://abcdefghijklmnopqrst.supabase.co"},{projectUrl:projectUrl+"/other"},{projectUrl:"https://evil.example"},{publishableKey:"sb_secret_fixture_only"},{sessionExists:null}])
    assert.throws(()=>fixture(p));
});
