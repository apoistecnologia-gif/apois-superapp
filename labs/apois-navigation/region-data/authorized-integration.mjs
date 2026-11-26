// Real IBGE candidate, synthetic authority and synthetic upstream. Loopback only.
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {join} from 'node:path';
import {createPolygonRegion} from '../valhalla/region-policy.mjs';
import {createRouteIssuer,routeBody} from '../valhalla/route-issuer.mjs';
import {createRouteGateway} from '../valhalla/route-gateway.mjs';
import {createRouteAuthorization} from '../valhalla/route-authorization.mjs';
const dir=process.argv[2];
const sha='f1a9e0ed64b711981fdda17b45e8b838836eda812d13da6e03e69aed3e6837c3';
const source='02349e4f4567354215903c6bd2b56c3b93f1edd17065b1d70efde5bada5138de';
const raw=readFileSync(join(dir,'nordeste-candidate.geojson'));
const report=JSON.parse(readFileSync(join(dir,'region-report.json')));
assert.equal(report.candidate_sha256,sha);assert.equal(report.source_sha256,source);assert.equal(report.active,false);
const contains=createPolygonRegion(raw,sha);
const fixture=JSON.parse(readFileSync(new URL('../northeast/samples.json',import.meta.url)));
const ids=Array.from({length:5},(_,i)=>'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
const k=generateKeyPairSync('ed25519'),audience='lab-ibge-'+sha;
let evidence,upstreamCalls=0;
const authority=async(session,req)=>session==='synthetic'&&evidence?.rideId===req.rideId&&evidence?.phase===req.phase?{
 authUserId:ids[0],profileUserId:ids[1],driverId:ids[2],rideId:ids[3],assignedDriverId:ids[2],acceptedDriverId:ids[2],
 status:'motorista_a_caminho',category:'carros',intermediateStops:0,verifiedAt:Date.now(),
 targetEvidence:{id:ids[4],version:1,rideId:ids[3],phase:'PICKUP',source:'INDEPENDENT_OSM',point:evidence.target}
}:null;
const issue=createRouteIssuer({privateKey:k.privateKey,principalKey:randomBytes(32),audience,contains,readAuthority:authority});
const auth=createRouteAuthorization({publicKey:k.publicKey,audience,perMinute:64});
const upstream=createServer(async(req,res)=>{
 upstreamCalls++;
 assert.equal(req.headers.authorization,undefined);assert.equal(req.url,'/route');
 let text='';for await(const c of req)text+=c;
 const body=JSON.parse(text);
 res.setHeader('Content-Type','application/json');
 res.end(JSON.stringify({code:'Ok',routes:[{fixture:true,locations:body.locations}]}));
});
async function bind(s){await new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r)});return s.address().port}
let gateway;
const cases=[];
function result(name,actual,expected){assert.equal(actual,expected,name);cases.push({name,status:actual})}
try{
 const port=await bind(upstream);
 gateway=createRouteGateway({upstreamPort:port,contains,authorize:auth});
 const url='http://127.0.0.1:'+await bind(gateway)+'/route';
 const post=async(body,token)=>{
 const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;
 const r=await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});const value=await r.json();
 assert.equal(r.headers.get('cache-control'),'no-store');return {status:r.status,value}
 };
 for(const [uf,name,lat,lon] of fixture.cities){
 const origin={lat,lon},target={lat:lat+0.0001,lon};
 evidence={rideId:ids[3],phase:'PICKUP',origin,target};
 const permit=await issue('synthetic',evidence);result(uf+' '+name+' issuance',permit.status,200);
 const body=routeBody(origin,target,contains);assert.ok(body);
 const r=await post(body,permit.token);result(uf+' '+name+' gateway',r.status,200);
 assert.deepEqual(r.value.routes[0].locations,body.locations);
 if(name==='Itainópolis'){
 result('replay',(await post(body,permit.token)).status,403);
 result('without credential',(await post(body)).status,401);
 const changed=await issue('synthetic',evidence);assert.equal(changed.status,200);
 result('changed signed route',(await post(routeBody(origin,{lat:lat+0.0002,lon},contains),changed.token)).status,403);
 const outside={lat:-15.7939,lon:-47.8828};
 result('outside issuance',(await issue('synthetic',{...evidence,target:outside})).status,400);
 const invalid={...body,locations:[body.locations[0],{...outside,type:'break'}]};
 result('outside gateway',(await post(invalid,changed.token)).status,400);
 result('unverified session',(await issue('invalid',evidence)).status,403);
 }
 }
 assert.equal(upstreamCalls,11);
 const output={regionSha256:sha,sourceSha256:source,active:false,upstreamCalls,cases,limits:'Actual geographic candidate and authorization path; synthetic upstream and authority, no real routing or production'};
 writeFileSync(join(dir,'authorized-region-report.json'),JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output));
}finally{for(const s of [gateway,upstream])if(s?.listening){s.closeAllConnections();await new Promise(r=>s.close(r))}}
