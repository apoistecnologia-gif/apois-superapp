// Executed only inside the disposable PostgreSQL CI fixture after test.sql.
// No Supabase endpoint or credentials. Synthetic verifier is intentionally
// NOT real authentication. SQL reads execute as the private service role.
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {generateKeyPairSync,randomBytes} from "node:crypto";
import {mkdtempSync,rmSync} from "node:fs";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {createDriverAuthority} from "./driver-authority.mjs";
import {createRouteIssuer,routeBody,routeLegScope} from "../valhalla/route-issuer.mjs";
import {createRouteAuthorization} from "../valhalla/route-authorization.mjs";
import {openRouteReplayStore} from "../valhalla/route-replay-store.mjs";
const a="00000000-0000-4000-8000-000000000061",b="00000000-0000-4000-8000-000000000062",
driver="00000000-0000-4000-8000-000000000071",ride="00000000-0000-4000-8000-000000000041";
const safeId=/^[0-9a-f-]{36}$/;
const sql=s=>execFileSync("docker",["exec","-i","apois-provenance-fixture","psql","-X","-qAt","-U","postgres","-d","apois_navigation_fixture","-v","ON_ERROR_STOP=1"],{input:s,encoding:"utf8",timeout:4000,maxBuffer:65536}).trim();
function phase(status){
  assert.ok(["motorista_a_caminho","motorista_chegou","em_viagem","finalizada"].includes(status));
  sql("update public.rides set driver_id='"+driver+"',accepted_driver_id='"+driver+"',status='"+status+"' where id='"+ride+"';");
}
let reads=0;
const authority=createDriverAuthority({
  verifySession:async token=>token==="fixture-driver-a"?a:token==="fixture-driver-b"?b:null,
  readDriverProof:async({authUserId,rideId,phase},signal)=>{
    assert.ok(safeId.test(authUserId)&&safeId.test(rideId)&&["PICKUP","TRIP"].includes(phase));
    if(signal.aborted)return null;
    reads++;
    const out=sql("set role service_role; select apois_nav_lab.read_driver_proof('"+authUserId+"','"+rideId+"','"+phase+"');");
    return out?JSON.parse(out):null;
  }
});
const keys=generateKeyPairSync("ed25519"),principalKey=randomBytes(32),audience="fixture-db-to-issuer";
const dir=mkdtempSync(join(tmpdir(),"apois-pg-proof-"));
const store=openRouteReplayStore({path:join(dir,"replay.sqlite"),initialize:true,requireIssued:true,requireScoped:true});
const issue=createRouteIssuer({privateKey:keys.privateKey,principalKey,audience,readAuthority:authority,issuanceStore:store,scopedIssuance:true});
const authorize=createRouteAuthorization({publicKey:keys.publicKey,audience,store});
const pickup={rideId:ride,phase:"PICKUP",origin:{lat:-9.41,lon:-40.505},target:{lat:-9.4,lon:-40.5}};
const trip={...pickup,phase:"TRIP",target:{lat:-9.42,lon:-40.51}};
const admit=(token,req)=>authorize("Bearer "+token,routeBody(req.origin,req.target));
try{
  phase("motorista_a_caminho");
  assert.equal((await issue("invalid",pickup)).status,403);assert.equal(reads,0);
  assert.equal((await issue("fixture-driver-b",pickup)).status,403);
  assert.equal((await issue("fixture-driver-a",trip)).status,403);
  assert.equal((await issue("fixture-driver-a",{...pickup,target:{lat:-9.43,lon:-40.5}})).status,403);
  const valid=await issue("fixture-driver-a",pickup);assert.equal(valid.status,200);
  const grant=admit(valid.token,pickup);assert.equal(grant.status,200);grant.release();
  assert.equal(admit(valid.token,pickup).status,403);
  const pending=await issue("fixture-driver-a",pickup);assert.equal(pending.status,200);
  phase("motorista_chegou");
  assert.equal((await issue("fixture-driver-a",pickup)).status,403);
  // Explicit synthetic lifecycle notification: not a real event consumer.
  assert.equal(store.revokeScope(routeLegScope(principalKey,audience,ride,"PICKUP"),Date.now()).status,200);
  assert.equal(admit(pending.token,pickup).status,403);
  phase("em_viagem");
  const next=await issue("fixture-driver-a",trip);assert.equal(next.status,200);
  assert.equal(admit(next.token,pickup).status,403);
  const g=admit(next.token,trip);assert.equal(g.status,200);g.release();
  phase("finalizada");
  assert.equal((await issue("fixture-driver-a",trip)).status,403);
  console.log("APOIS_SQL_ISSUER_INTEGRATION_OK",{sqlReads:reads,realPostgres:true,syntheticAuthentication:true,manualRevocation:true});
}finally{store.close();rmSync(dir,{recursive:true,force:true});}
