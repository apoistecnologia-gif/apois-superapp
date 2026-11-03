// APOIS Motorista: isolated Edge mail outbox regression (Bun VM).
// No real Resend, Supabase, emails, accounts, or production mutations.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source=readFileSync("supabase/functions/apois-driver-review-mailer/index.ts","utf8");
const sql=readFileSync("supabase/corridas-forward-migrations/20261031_driver_correction_notifications_QA_NOT_APPLIED.sql","utf8");
assert.match(sql,/o\.status IN \('queued','failed','accepted_by_provider'\)/);
assert.match(source,/getUser\(token\)/);
assert.match(source,/apois_admin_can_dispatch_driver_correction_mail/);
assert.match(source,/Idempotency-Key/);
assert.match(source,/provider_acceptance_not_recorded/);
assert.match(source,/provider_receipt_missing/);
assert.match(source,/\.in\("status",\["queued","failed"\]\)\.select\("id"\)\.maybeSingle\(\)/);
assert.doesNotMatch(source,/await service\.from\("apois_driver_correction_email_outbox"\)\.update\(\{\s*status:"accepted_by_provider"[\s\S]*?\}\)\.eq\("id",mail\.id\);\s*return json\(200,/);
const stripped=source.split("\n").filter(line=>!line.startsWith("import {serve}")&&!line.startsWith("import {createClient}")).join("\n");
const js=new Bun.Transpiler({loader:"ts",target:"browser"}).transformSync(stripped);
const requestId="11111111-2222-3333-4444-555555555555";
let passed=0;
async function test(name,fn){await fn();passed++;console.log("[OK] "+name);}
function makeFixture({accepted=false,writeError=false,zeroRows=false,providerStatus=200,providerId="resend-fixture",permission=true,validSession=true}={}) {
 let handler, sends=0, updates=0;
 const mail={id:"outbox-fixture",request_id:requestId,to_email:"qa@example.invalid",
   status:accepted?"accepted_by_provider":"queued",attempts:accepted?1:0,provider_id:accepted?"resend-fixture":null};
 const queryFor=(table)=>{
   let operation="select",patch=null,filters=[],statusFilter=null;
   const execute=async(single)=>{
     if(table==="apois_driver_correction_email_outbox"){
       if(operation==="update"){
         updates++;
         if(writeError)return {data:null,error:{message:"fixture_db_failure"}};
         if(zeroRows||mail.id!==filters.find(x=>x[0]==="id")?.[1]||
             (statusFilter&&!statusFilter.includes(mail.status)))return {data:single?null:[],error:null};
         Object.assign(mail,patch);
         return {data:single?{id:mail.id}:[{id:mail.id}],error:null};
       }
       return {data:{...mail},error:null};
     }
     if(table==="apois_driver_correction_requests")return {data:{reason:"Falta foto nítida",
        required_items:["front"],driver_id:"driver-fixture"},error:null};
     if(table==="drivers")return {data:{name:"Motorista QA"},error:null};
     throw new Error("Unexpected DB table "+table);
   };
   const q={
     select(){return this;},
     eq(key,val){filters.push([key,val]);return this;},
     in(key,vals){if(key==="status")statusFilter=vals;return this;},
     update(payload){operation="update";patch=payload;return this;},
     maybeSingle(){return execute(true);},
     single(){return execute(true);},
     then(ok,fail){return execute(false).then(ok,fail);},
   };return q;
 };
 const anonClient={
   auth:{getUser:async()=>({data:{user:validSession?{id:"staff-fixture"}:null},
     error:validSession?null:{message:"invalid"}})},
   rpc:async()=>({data:permission,error:null}),
 };
 const serviceClient={from:queryFor};
 const env={SUPABASE_URL:"https://fixture.invalid",SUPABASE_ANON_KEY:"anon-fixture",
   SUPABASE_SERVICE_ROLE_KEY:"service-fixture",RESEND_API_KEY:"resend-fixture-secret",
   APOIS_EMAIL_FROM:"qa@sender.invalid"};
 const context={
   serve(fn){handler=fn;},
   createClient(_url,key){return key===env.SUPABASE_ANON_KEY?anonClient:serviceClient;},
   Deno:{env:{get(k){return env[k]??null}}},
   fetch:async(_url,options)=>{sends++;assert.equal(options.headers["Idempotency-Key"],"apois-driver-review-"+requestId);
     return {ok:providerStatus<300,status:providerStatus,
       async json(){return providerId?{id:providerId}:{}}};},
   Response,Request,console,Date,JSON,String,Array,Object,
 };
 vm.runInNewContext(js,context,{filename:"apois-driver-review-mailer/index.ts"});
 return {
   mail,get sends(){return sends},get updates(){return updates},
   async invoke({auth="Bearer header.payload.sig",id=requestId,method="POST"}={}){
     const request=new Request("https://fixture.invalid",{method,headers:{authorization:auth},
       ...(method==="POST"?{body:JSON.stringify({request_id:id})}:{})});
     const result=await handler(request);
     return {status:result.status,body:await result.json()};
   },
 };
}
await test("missing JWT and invalid request are rejected before provider send",async()=>{
 const f=makeFixture();
 assert.equal((await f.invoke({auth:"Bearer invalid"})).status,401);
 assert.equal((await f.invoke({id:"../../x"})).status,400);
 assert.equal((await f.invoke({method:"GET"})).status,405);
 assert.equal(f.sends,0);
});
await test("unauthorized staff cannot dispatch",async()=>{
 const f=makeFixture({permission:false});
 assert.equal((await f.invoke()).status,403);
 assert.equal(f.sends,0);
});
await test("successful provider delivery is recorded before returning 200",async()=>{
 const f=makeFixture();const r=await f.invoke();
 assert.equal(r.status,200);
 assert.equal(f.mail.status,"accepted_by_provider");
 assert.equal(f.mail.provider_id,"resend-fixture");
 assert.equal(f.mail.attempts,1);
 assert.equal(f.sends,1);
});
await test("database write error rejects false success",async()=>{
 const f=makeFixture({writeError:true});const r=await f.invoke();
 assert.equal(r.status,503);
 assert.equal(r.body.error,"provider_acceptance_not_recorded");
 assert.equal(f.mail.status,"queued");
 assert.equal(f.sends,1);
});
await test("zero-row conditional update rejects false success",async()=>{
 const f=makeFixture({zeroRows:true});const r=await f.invoke();
 assert.equal(r.status,503);
 assert.equal(f.mail.status,"queued");
});
await test("provider success without receipt ID is not recorded",async()=>{
 const f=makeFixture({providerId:""});const r=await f.invoke();
 assert.equal(r.status,503);
 assert.equal(r.body.error,"provider_receipt_missing");
 assert.equal(f.mail.status,"queued");
 assert.equal(f.updates,0);
});
await test("provider failure does not claim accepted",async()=>{
 const f=makeFixture({providerStatus:429});const r=await f.invoke();
 assert.equal(r.status,502);
 assert.equal(f.mail.status,"failed");
 assert.equal(f.mail.attempts,1);
});
await test("accepted outbox is acknowledged idempotently, without duplicate email",async()=>{
 const f=makeFixture({accepted:true});const r=await f.invoke();
 assert.equal(r.status,200);
 assert.equal(r.body.already_processed,true);
 assert.equal(f.sends,0);
 assert.equal(f.updates,0);
});
console.log("[PASS] "+passed+" isolated driver review mail regressions (no network, no email).");
