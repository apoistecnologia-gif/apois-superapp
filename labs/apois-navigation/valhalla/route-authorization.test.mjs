import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,sign,randomBytes} from "node:crypto";
import {createServer} from "node:http";
import {createRouteAuthorization,routeDigest} from "./route-authorization.mjs";
import {normalizeRoute,createRouteGateway} from "./route-gateway.mjs";
const {publicKey,privateKey}=generateKeyPairSync("ed25519");
const body=normalizeRoute({locations:[{lat:-9.4,lon:-40.5,type:"break"},{lat:-9.42,lon:-40.51,type:"break"}],
  costing:"auto",units:"kilometers",language:"pt-BR",format:"osrm",voice_instructions:true,banner_instructions:true,shape_format:"polyline6"});
const other={...body,locations:[body.locations[0],{lat:-9.43,lon:-40.51,type:"break"}]};
function fixture(options={}){
  let time=100000;
  const audience="apois-local-route-test";
  const auth=createRouteAuthorization({publicKey,audience,now:()=>time,...options});
  const permit=(over={},key=privateKey)=>{
    const claim={aud:audience,iat:time,exp:time+30000,jti:randomBytes(18).toString("base64url"),
      sub:"a".repeat(64),route:routeDigest(body),...over};
    const bytes=Buffer.from(JSON.stringify(claim));
    return "Bearer "+bytes.toString("base64url")+"."+sign(null,bytes,key).toString("base64url");
  };
  return {auth,permit,setTime:t=>{time=t}};
}
test("signed capability is bound to exact normalized route and consumed once",()=>{
  const {auth,permit}=fixture();
  const token=permit();
  assert.equal(auth(token,other).status,403);
  const grant=auth(token,body);assert.equal(grant.status,200);
  grant.release();grant.release();
  assert.equal(auth(token,body).status,403);
});
test("rejects missing malformed foreign or altered signatures",()=>{
  const {auth,permit}=fixture();
  for(const t of [undefined,"Bearer garbage","Bearer "+ "x".repeat(2049),
    permit({},generateKeyPairSync("ed25519").privateKey),permit().replace(/.$/,"!")]){
    assert.equal(auth(t,body).status,401);
  }
});
test("rejects wrong audience, extra claims and invalid or expired time window",()=>{
  const {auth,permit,setTime}=fixture();
  for(const patch of [{aud:"other"},{rideId:"raw"},{iat:100001},{exp:130001},{exp:99999},{sub:"driver"}]){
    assert.equal(auth(permit(patch),body).status,403);
  }
  const p=permit();setTime(130000);assert.equal(auth(p,body).status,403);
  setTime(129999);assert.equal(auth(p,body).status,503);
});
test("per-principal concurrency and minute quota with bounded state",()=>{
  const {auth,permit,setTime}=fixture({perMinute:2,maxPrincipals:2,maxEntries:4});
  const a=auth(permit(),body);assert.equal(a.status,200);
  assert.equal(auth(permit(),body).status,429);
  const b=auth(permit({sub:"b".repeat(64)}),body);assert.equal(b.status,200);
  assert.equal(auth(permit({sub:"c".repeat(64)}),body).status,429);
  a.release();b.release();
  const c=auth(permit(),body);assert.equal(c.status,200);c.release();
  assert.equal(auth(permit(),body).status,429);
  setTime(160000);const d=auth(permit(),body);assert.equal(d.status,200);d.release();
});
test("replay storage capacity fails closed and expires without evicting live tokens",()=>{
  const {auth,permit,setTime}=fixture({maxEntries:1});
  const p=permit(),a=auth(p,body);assert.equal(a.status,200);a.release();
  assert.equal(auth(permit(),body).status,429);
  assert.equal(auth(p,body).status,403);
  setTime(130000);const b=auth(permit(),body);assert.equal(b.status,200);b.release();
});
async function bind(s){await new Promise((r,j)=>{s.once("error",j);s.listen(0,"127.0.0.1",r)});return s.address().port;}
test("HTTP gateway rejects unsigned/changed/replayed capabilities before upstream and strips credentials",async t=>{
  let calls=0,headers;
  const upstream=createServer(async(req,res)=>{
    calls++;headers=req.headers;
    for await(const _ of req){}
    res.end(JSON.stringify({code:"Ok",routes:[{}]}));
  });
  const port=await bind(upstream);
  const {auth,permit}=fixture();
  const gateway=createRouteGateway({upstreamPort:port,authorize:auth});
  const gport=await bind(gateway);
  t.after(async()=>{gateway.closeAllConnections();upstream.closeAllConnections();await Promise.all([gateway,upstream].map(s=>new Promise(r=>s.close(r))));});
  const post=(token,value=body)=>fetch("http://127.0.0.1:"+gport+"/route",{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:token}:{})},body:JSON.stringify(value)});
  assert.equal((await post()).status,401);
  const p=permit();
  assert.equal((await post(p,other)).status,403);
  assert.equal(calls,0);
  assert.equal((await post(p)).status,200);
  assert.equal(headers.authorization,undefined);
  assert.equal((await post(p)).status,403);
  assert.equal(calls,1);
});
