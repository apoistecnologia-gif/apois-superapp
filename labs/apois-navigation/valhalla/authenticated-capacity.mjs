// Bounded sustained local experiment. Never accepts a remote URL, real account,
// production credentials or a live ride. Raised limits exist ONLY in this fixture.
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes} from "node:crypto";
import {writeFileSync,mkdtempSync,rmSync,statSync,existsSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {setTimeout as sleep} from "node:timers/promises";
import {monitorEventLoopDelay} from "node:perf_hooks";
import {openRouteReplayStore} from "./route-replay-store.mjs";
import {createRouteIssuer,routeBody} from "./route-issuer.mjs";
import {createRouteAuthorization} from "./route-authorization.mjs";
import {createRouteGateway,createBudget} from "./route-gateway.mjs";
const [out,container]=process.argv.slice(2);
assert.ok(out&&/^apois-valhalla-lab-[0-9]+$/.test(container??""),"local fixture container only");
const {publicKey,privateKey}=generateKeyPairSync("ed25519");
const audience="apois-capacity-synthetic";
const principalKey=randomBytes(32);
const id=i=>"00000000-0000-4000-8000-"+String(i).padStart(12,"0");
const point=(lat,lon)=>Object.freeze({lat,lon});
const P=point(-9.403901,-40.5040233),J=point(-9.4165,-40.5035);
const routes=[[P,point(-9.3800,-40.5020)],[J,point(-9.4250,-40.4980)],[P,J],[J,P],[point(-9.3990,-40.5220),J]];
const concurrency=4,waves=75,drivers=80,intervalMs=1000;
const sessions=Array.from({length:drivers},(_,i)=>Object.freeze({index:i}));
const requests=sessions.map(({index:i})=>Object.freeze({rideId:id(1000+i),phase:"PICKUP",origin:routes[i%routes.length][0],target:routes[i%routes.length][1]}));
const limits={globalPerMinute:300,globalParallel:4,perMinute:6,parallel:1};
const dir=mkdtempSync(join(tmpdir(),"apois-capacity-"));
const path=join(dir,"replay.sqlite");
const store=openRouteReplayStore({path,initialize:true,requireIssued:true,requireScoped:true,...limits});
const issue=createRouteIssuer({privateKey,principalKey,audience,issuanceStore:store,scopedIssuance:true,readAuthority:async(s,r)=>{
  const i=s?.index;
  if(!Number.isInteger(i)||sessions[i]!==s||requests[i]?.rideId!==r.rideId||r.phase!=="PICKUP")return null;
  const driver=id(3000+i);
  return {authUserId:id(4000+i),profileUserId:id(5000+i),driverId:driver,rideId:r.rideId,status:"motorista_a_caminho",
    assignedDriverId:driver,acceptedDriverId:driver,category:"carros",intermediateStops:0,verifiedAt:Date.now(),
    targetEvidence:{id:id(6000+i),version:1,rideId:r.rideId,phase:r.phase,source:"INDEPENDENT_OSM",point:requests[i].target}};
}});
const gateway=createRouteGateway({authorize:createRouteAuthorization({publicKey,audience,store}),budget:createBudget({limit:300,parallel:4})});
const docker=promisify(execFile);
const delay=monitorEventLoopDelay({resolution:20});
const results=[],samples=[],sampleErrors=[];
let sampleInFlight=null,sampleTimer=null,start=0,cpuStart;
function sample(){
  if(sampleInFlight)return;
  sampleInFlight=(async()=>{
    const m=process.memoryUsage(),elapsedMs=performance.now()-start;
    try{
      const {stdout}=await docker("docker",["stats","--no-stream","--format","{{json .}}",container],{timeout:5000,maxBuffer:16384});
      const d=JSON.parse(stdout.trim());
      samples.push({elapsedMs:Math.round(elapsedMs),nodeRssBytes:m.rss,nodeHeapUsedBytes:m.heapUsed,
        sqliteBytes:[path,path+"-wal",path+"-shm"].reduce((n,p)=>n+(existsSync(p)?statSync(p).size:0),0),
        valhallaCpu:d.CPUPerc,valhallaMemory:d.MemUsage});
    }catch{sampleErrors.push(Math.round(elapsedMs));}
  })().finally(()=>{sampleInFlight=null;});
}
const stats=values=>{
  const a=[...values].sort((x,y)=>x-y);
  if(!a.length)return null;
  const round=x=>Math.round(x*100)/100;
  return {medianMs:round((a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2),
    p95Ms:round(a[Math.ceil(a.length*.95)-1]),maxMs:round(a.at(-1))};
};
try{
  await new Promise((r,j)=>{gateway.once("error",j);gateway.listen(0,"127.0.0.1",r);});
  const url="http://127.0.0.1:"+gateway.address().port+"/route";
  async function request(n){
    const i=n%drivers,req=requests[i],began=performance.now();
    let issuedAt=null;
    try{
      const permit=await issue(sessions[i],req);
      issuedAt=performance.now();
      if(permit.status!==200){results.push({stage:"issuer",status:permit.status,totalMs:issuedAt-began});return;}
      const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+permit.token},
        body:JSON.stringify(routeBody(req.origin,req.target)),signal:AbortSignal.timeout(15000)});
      const bytes=await response.arrayBuffer();
      if(response.status!==200){results.push({stage:"gateway",status:response.status,totalMs:performance.now()-began});return;}
      const data=JSON.parse(Buffer.from(bytes).toString("utf8")),route=data.routes?.[0];
      if(data.code!=="Ok"||!Number.isFinite(route?.distance)||route.distance<=0||!Number.isFinite(route.duration)||route.duration<=0||
        !route.legs?.some(l=>l.steps?.some(s=>s.voiceInstructions?.length))){
        results.push({stage:"contract",status:0,totalMs:performance.now()-began});return;
      }
      results.push({stage:"ok",status:200,totalMs:performance.now()-began,issueMs:issuedAt-began,
        gatewayMs:performance.now()-issuedAt,responseBytes:bytes.byteLength});
    }catch{results.push({stage:"transport",status:0,totalMs:performance.now()-began});}
  }
  start=performance.now();cpuStart=process.cpuUsage();delay.enable();sample();
  sampleTimer=setInterval(sample,5000);
  // No overlapping waves, no retries, and no catch-up burst if the server slows.
  for(let wave=0;wave<waves;wave++){
    const began=performance.now();
    await Promise.all(Array.from({length:concurrency},(_,i)=>request(wave*concurrency+i)));
    if(wave+1<waves)await sleep(Math.max(0,intervalMs-(performance.now()-began)));
  }
  const elapsed=(performance.now()-start)/1000,cpu=process.cpuUsage(cpuStart);
  delay.disable();clearInterval(sampleTimer);await sampleInFlight;
  sample();await sampleInFlight;
  const ok=results.filter(r=>r.stage==="ok");
  const failures={};for(const r of results.filter(r=>r.stage!=="ok")){const k=r.stage+":"+r.status;failures[k]=(failures[k]??0)+1;}
  const report={scope:"local synthetic authority + Ed25519 + SQLite scoped issuance + HTTP gateway + real Valhalla; no Internet or real authentication",
    configuredLimits:limits,gatewayLimitPerMinute:300,waves,concurrency,syntheticDrivers:drivers,intervalMs,
    requests:results.length,successes:ok.length,failures,durationSeconds:Math.round(elapsed*100)/100,
    requestsPerSecond:Math.round(results.length/elapsed*100)/100,
    totalLatency:stats(ok.map(r=>r.totalMs)),issuerLatency:stats(ok.map(r=>r.issueMs)),gatewayLatency:stats(ok.map(r=>r.gatewayMs)),
    responseBytes:{total:ok.reduce((n,r)=>n+r.responseBytes,0),max:ok.reduce((n,r)=>Math.max(n,r.responseBytes),0)},
    nodeCpuSeconds:{user:cpu.user/1e6,system:cpu.system/1e6},eventLoopDelayP95Ms:delay.percentile(95)/1e6,
    peakSampledNodeRssBytes:Math.max(0,...samples.map(s=>s.nodeRssBytes)),peakSampledSqliteBytes:Math.max(0,...samples.map(s=>s.sqliteBytes)),
    samples,sampleErrors,limitations:"75 paced waves; sampled resources, not continuous peak; fake authority, no TLS/mobile network or production load. Quotas raised only for this fixture."};
  writeFileSync(join(out,"authenticated-capacity-report.json"),JSON.stringify(report,null,2));
  console.log("APOIS_AUTHENTICATED_CAPACITY",JSON.stringify(report));
  assert.equal(results.length,waves*concurrency);assert.equal(ok.length,results.length);
  assert.ok(elapsed>=73,"sustained window did not run");
  assert.ok(samples.length>=2,"resource samples missing");
}finally{
  if(sampleTimer)clearInterval(sampleTimer);delay.disable();await sampleInFlight;
  gateway.closeAllConnections();await new Promise(r=>gateway.close(r));
  store.close();rmSync(dir,{recursive:true,force:true});
}
