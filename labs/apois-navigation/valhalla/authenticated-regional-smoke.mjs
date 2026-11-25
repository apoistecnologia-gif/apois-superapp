// Real Valhalla behind the authorization gateway, using ONLY fixed public
// geographic test points and fake server authority. No actual users or issuer API.
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes} from "node:crypto";
import {writeFileSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {openRouteReplayStore} from "./route-replay-store.mjs";
import {join} from "node:path";
import {createRouteIssuer,routeBody,routeLegScope} from "./route-issuer.mjs";
import {createRouteAuthorization} from "./route-authorization.mjs";
import {createRouteGateway} from "./route-gateway.mjs";
const {publicKey,privateKey}=generateKeyPairSync("ed25519");
const audience="apois-regional-synthetic";
const id=i=>"00000000-0000-4000-8000-"+String(i).padStart(12,"0");
const origin={lat:-9.403901,lon:-40.5040233},target={lat:-9.4165,lon:-40.5035};
const req={rideId:id(4),phase:"PICKUP",origin,target};
const session=Object.freeze({});
const dir=mkdtempSync(join(tmpdir(),"apois-regional-replay-"));
const store=openRouteReplayStore({path:join(dir,"replay.sqlite"),initialize:true,requireIssued:true,requireScoped:true});
const principalKey=randomBytes(32);
const issue=createRouteIssuer({privateKey,principalKey,audience,issuanceStore:store,scopedIssuance:true,readAuthority:async(s,r)=>{
  if(s!==session||r.rideId!==req.rideId||r.phase!==req.phase)return null;
  return {authUserId:id(1),profileUserId:id(2),driverId:id(3),rideId:id(4),status:"motorista_a_caminho",
    assignedDriverId:id(3),acceptedDriverId:id(3),category:"carros",intermediateStops:0,verifiedAt:Date.now(),
    targetEvidence:{id:id(5),version:1,rideId:id(4),phase:"PICKUP",source:"INDEPENDENT_OSM",point:target}};
}});
const gateway=createRouteGateway({authorize:createRouteAuthorization({publicKey,audience,store})});
try{
  await new Promise((r,j)=>{gateway.once("error",j);gateway.listen(0,"127.0.0.1",r);});
  const url="http://127.0.0.1:"+gateway.address().port+"/route";
  const body=routeBody(origin,target);
  const post=(token,value=body)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},body:JSON.stringify(value),signal:AbortSignal.timeout(15000)});
  assert.equal((await post()).status,401);
  const revoked=await issue(session,req);assert.equal(revoked.status,200);
  // Trusted in-process operator, not a client revocation endpoint.
  const opaqueId=JSON.parse(Buffer.from(revoked.token.split(".")[0],"base64url")).jti;
  assert.equal(store.revoke(opaqueId,Date.now()).status,200);
  assert.equal((await post(revoked.token)).status,403);
  const issued=await issue(session,req);assert.equal(issued.status,200);
  assert.equal((await post(issued.token,routeBody(origin,{lat:-9.42,lon:-40.51}))).status,403);
  const response=await post(issued.token);assert.equal(response.status,200);
  const data=await response.json();assert.equal(data.code,"Ok");
  const route=data.routes[0];assert.ok(route.distance>500&&route.distance<15000);
  assert.ok(route.legs.flatMap(l=>l.steps).some(s=>s.voiceInstructions?.length));
  assert.equal((await post(issued.token)).status,403);
  const pending=await issue(session,req);assert.equal(pending.status,200);
  assert.equal(store.revokeScope(routeLegScope(principalKey,audience,req.rideId,req.phase),Date.now()).status,200);
  assert.equal((await post(pending.token)).status,403);
  assert.equal((await issue(session,req)).status,403);
  const report={scopeRevokedRejected:true,newIssueRejected:true,authorizedRoute:true,missingRejected:true,modifiedRejected:true,replayRejected:true,revokedRejected:true,distanceM:route.distance,scope:"synthetic public points; loopback only"};
  writeFileSync(join(process.argv[2],"authenticated-regional-report.json"),JSON.stringify(report,null,2));
  console.log("APOIS_AUTHENTICATED_REGIONAL_OK",JSON.stringify(report));
}finally{
  gateway.closeAllConnections();await new Promise(r=>gateway.close(r));
  store.close();rmSync(dir,{recursive:true,force:true});
}
