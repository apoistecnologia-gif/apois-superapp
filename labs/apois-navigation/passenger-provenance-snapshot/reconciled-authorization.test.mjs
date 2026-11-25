import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {generateKeyPairSync,randomBytes} from "node:crypto";
import {createRouteIssuer,routeBody} from "../valhalla/route-issuer.mjs";
import {createRouteGateway} from "../valhalla/route-gateway.mjs";
import {createReconciledAuthorization} from "./reconciled-authorization.mjs";
const ids=Array.from({length:5},(_,i)=>"00000000-0000-4000-8000-"+String(i+1).padStart(12,"0"));
const req={rideId:ids[3],phase:"PICKUP",origin:{lat:-9.4,lon:-40.5},target:{lat:-9.42,lon:-40.51}};
const body=routeBody(req.origin,req.target);
const keys=generateKeyPairSync("ed25519"),audience="reconciliation-fixture";
async function token(){
  const issue=createRouteIssuer({privateKey:keys.privateKey,principalKey:randomBytes(32),audience,readAuthority:async()=>({
    authUserId:ids[0],profileUserId:ids[1],driverId:ids[2],rideId:ids[3],status:"motorista_a_caminho",acceptedDriverId:ids[2],
    category:"carros",intermediateStops:0,verifiedAt:Date.now(),targetEvidence:{id:ids[4],version:1,rideId:ids[3],phase:"PICKUP",source:"INDEPENDENT_OSM",point:req.target}
  })});
  const r=await issue({},req);assert.equal(r.status,200);return "Bearer "+r.token;
}
async function bind(s){await new Promise(r=>s.listen(0,"127.0.0.1",r));return s.address().port;}
test("HTTP gateway reconciles only signed routes, fails closed and forwards only after success",async t=>{
  let reads=0,admissions=0,upstream=0,mode="down",revoked=false;
  const authorize=createReconciledAuthorization({publicKey:keys.publicKey,audience,store:{admit:()=>{admissions++;return revoked?{status:403}:{status:200,release(){}};}},
    reconcile:async()=>{reads++;if(mode==="down")return {status:503};if(mode==="revoked")revoked=true;return {status:200};}});
  const u=createServer((_req,res)=>{upstream++;res.end(JSON.stringify({code:"Ok",routes:[{}]}));});
  const gateway=createRouteGateway({upstreamPort:await bind(u),authorize});
  const port=await bind(gateway);
  t.after(async()=>{gateway.closeAllConnections();u.closeAllConnections();await Promise.all([gateway,u].map(s=>new Promise(r=>s.close(r))));});
  const post=authorization=>fetch("http://127.0.0.1:"+port+"/route",{method:"POST",headers:{"Content-Type":"application/json",authorization},body:JSON.stringify(body)});
  assert.equal((await post("invalid")).status,401);assert.equal(reads,0);
  const permit=await token();
  assert.equal((await post(permit)).status,503);assert.equal(admissions,0);assert.equal(upstream,0);
  mode="revoked";assert.equal((await post(permit)).status,403);assert.equal(upstream,0);
  mode="ok";revoked=false;assert.equal((await post(permit)).status,200);assert.equal(upstream,1);assert.equal(reads,3);
});
test("gateway timeout never forwards a late successful grant and releases lease",async t=>{
  let finish,released=0,upstream=0;
  const u=createServer((_q,res)=>{upstream++;res.end("{}");});
  const g=createRouteGateway({upstreamPort:await bind(u),authorizationTimeout:50,authorize:()=>new Promise(r=>{finish=r;})});
  const port=await bind(g);
  t.after(async()=>{g.closeAllConnections();u.closeAllConnections();await Promise.all([g,u].map(s=>new Promise(r=>s.close(r))));});
  const response=await fetch("http://127.0.0.1:"+port+"/route",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  assert.equal(response.status,503);finish({status:200,release(){released++;}});await new Promise(r=>setImmediate(r));
  assert.equal(upstream,0);assert.equal(released,1);
});
