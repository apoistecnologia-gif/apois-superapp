import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {mkdtempSync,writeFileSync,chmodSync,symlinkSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {pilotGateway,readFieldSecret} from "../field-dynamic/gateway.mjs";
const key="a".repeat(64);
const body={locations:[{lat:-7.4475,lon:-41.4786,type:"break"},{lat:-7.439992,lon:-41.474246,type:"break"}],costing:"auto",units:"kilometers",language:"pt-BR",format:"osrm",voice_instructions:true,banner_instructions:true,shape_format:"polyline6"};
const listen=s=>new Promise(resolve=>s.listen(0,"127.0.0.1",resolve));
const close=s=>new Promise(resolve=>s.close(resolve));
test("credential expires, revoked requests never reach upstream",async()=>{
 let now=1000,calls=0;
 const upstream=createServer((req,res)=>{calls++;req.resume();res.end(JSON.stringify({code:"Ok",routes:[{}]}));});
 await listen(upstream);
 const gateway=pilotGateway(key,upstream.address().port,{now:()=>now,expiresAt:901000});
 await listen(gateway);
 const call=async(secret=key)=> (await fetch("http://127.0.0.1:"+gateway.address().port+"/route",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+secret},body:JSON.stringify(body)})).status;
 try{
  assert.equal(await call("b".repeat(64)),401);
  assert.equal(await call(),200);
  now=900999;assert.equal(await call(),200);
  now=901000;assert.equal(await call(),401);
  now=900998;assert.equal(await call(),401);
  assert.equal(calls,2);
 }finally{await close(gateway);await close(upstream);}
});
test("rejects invalid expiry before binding",()=>{
 for(const expiry of [999,1000,901001,NaN])assert.throws(()=>pilotGateway(key,8002,{now:()=>1000,expiresAt:expiry}));
});

test("credential file is bounded, private, regular and not a symlink",()=>{
 const dir=mkdtempSync(join(tmpdir(),"apois-key-test-"));
 try{
  const file=join(dir,"secret"),link=join(dir,"link");
  writeFileSync(file,key+"\n",{mode:0o600});
  assert.equal(readFieldSecret(file),key);
  chmodSync(file,0o400);assert.equal(readFieldSecret(file),key);
  chmodSync(file,0o644);assert.throws(()=>readFieldSecret(file));
  chmodSync(file,0o600);symlinkSync(file,link);assert.throws(()=>readFieldSecret(link));
  writeFileSync(file," "+key);assert.throws(()=>readFieldSecret(file));
  writeFileSync(file,key.repeat(2));assert.throws(()=>readFieldSecret(file));
  assert.throws(()=>readFieldSecret(dir));
 }finally{rmSync(dir,{recursive:true,force:true});}
});
