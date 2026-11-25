import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {normalizeRoute,createBudget,createRouteGateway} from "./route-gateway.mjs";
const fixture=()=>({locations:[{lat:-9.4039,lon:-40.504,type:"break"},{lat:-9.4165,lon:-40.5035,type:"break"}],
  costing:"auto",units:"kilometers",language:"pt-BR",format:"osrm",voice_instructions:true,banner_instructions:true,shape_format:"polyline6"});
test("only exact Android two-point regional auto contract is accepted",()=>{
  assert.deepEqual(normalizeRoute(fixture()),fixture());
  for(const patch of [{costing:"motorcycle"},{language:"en-US"},{format:"json"},{voice_instructions:false},{foo:"private"},
    {locations:[{lat:0,lon:0,type:"break"},fixture().locations[1]]},{locations:[...fixture().locations,fixture().locations[0]]},
    {locations:[{...fixture().locations[0],source:"Google"},fixture().locations[1]]},{locations:[{...fixture().locations[0],lat:"-9.4"},fixture().locations[1]]}]){
    assert.equal(normalizeRoute({...fixture(),...patch}),null);
  }
});
test("bounded rate and concurrency, idempotent release, clock regression",()=>{
  let t=0;const b=createBudget({limit:2,parallel:1,now:()=>t});
  const one=b.enter();assert.ok(one);assert.equal(b.enter(),null);one();one();
  const two=b.enter();assert.ok(two);two();assert.equal(b.enter(),null);
  t=60000;const next=b.enter();assert.ok(next);next();t=59999;assert.equal(b.enter(),null);
});
async function bind(server){await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});return server.address().port;}
async function fixtureServer(t,handler,options={}){
  const upstream=createServer(handler);
  const upstreamPort=await bind(upstream);
  const gateway=createRouteGateway({upstreamPort,...options});
  const port=await bind(gateway);
  t.after(async()=>{gateway.closeAllConnections();upstream.closeAllConnections();await Promise.all([gateway,upstream].map(s=>new Promise(r=>s.close(r))));});
  const url="http://127.0.0.1:"+port;
  return {url,post:body=>fetch(url+"/route",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})};
}
test("forwards only normalized contract to fixed local upstream",async t=>{
  let received=null,headers=null;
  const {post,url}=await fixtureServer(t,async(req,res)=>{
    headers=req.headers;let raw="";for await(const c of req)raw+=c;received=JSON.parse(raw);
    res.setHeader("Content-Type","application/json");res.end(JSON.stringify({code:"Ok",routes:[{distance:2000}]}));
  });
  const response=await post(fixture());assert.equal(response.status,200);
  assert.deepEqual(received,fixture());assert.equal(headers.authorization,undefined);
  assert.equal(response.headers.get("cache-control"),"no-store");
  assert.equal((await fetch(url+"/healthz")).status,200);
});
test("rejects malformed or unsupported requests without upstream access",async t=>{
  let calls=0;const {post,url}=await fixtureServer(t,(_req,res)=>{calls++;res.end("{}");});
  assert.equal((await post({...fixture(),rideId:"private"})).status,400);
  assert.equal((await post({...fixture(),costing:"truck"})).status,400);
  assert.equal((await fetch(url+"/route")).status,405);
  assert.equal((await fetch(url+"/status")).status,404);
  assert.equal((await fetch(url+"/route",{method:"POST",headers:{"Content-Type":"text/plain"},body:"{}"})).status,415);
  assert.equal((await fetch(url+"/route",{method:"POST",headers:{"Content-Type":"application/json"},body:"x".repeat(4097)})).status,413);
  assert.equal(calls,0);
});
test("does not follow redirects and hides upstream response/error details",async t=>{
  let calls=0;const {post}=await fixtureServer(t,(_req,res)=>{calls++;res.writeHead(302,{Location:"/secret"});res.end("private");});
  const r=await post(fixture());assert.equal(r.status,502);assert.deepEqual(await r.json(),{error:"route_unavailable"});assert.equal(calls,1);
});
test("limits upstream response sizes, malformed replies and timeouts",async t=>{
  let calls=0;const {post}=await fixtureServer(t,(_req,res)=>{
    calls++;
    if(calls===1){res.writeHead(200,{"Content-Length":"2000001"});res.end();return;}
    if(calls===2){res.end("not json");return;}
    if(calls===3){res.end(JSON.stringify({code:"NoRoute",routes:[]}));return;}
    // no response: exercise bounded request lifetime
  },{timeout:150});
  for(let i=0;i<4;i++){const r=await post(fixture());assert.equal(r.status,502);assert.deepEqual(await r.json(),{error:"route_unavailable"});}
});
test("rate limit rejects further route work without leaking payload",async t=>{
  let calls=0;const {post}=await fixtureServer(t,(_req,res)=>{calls++;res.end(JSON.stringify({code:"Ok",routes:[{}]}));},{budget:createBudget({limit:1})});
  assert.equal((await post(fixture())).status,200);
  const r=await post(fixture());assert.equal(r.status,429);assert.deepEqual(await r.json(),{error:"route_budget"});assert.equal(calls,1);
});
