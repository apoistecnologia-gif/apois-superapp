// APOIS Safe2Pay QA: ensure no sandbox configuration can fall back to live
// credentials or silently create a real Pix. Uses Bun VM with fake fetch only.
// No network, payments, credentials, PostgreSQL or Supabase calls.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source=readFileSync("supabase/functions/_shared/safe2pay.ts","utf8");
assert.match(source,/safe2pay_environment_explicitly_required/);
assert.match(source,/safe2pay_pix_sandbox_not_confirmed/);
assert.match(source,/safe2pay_sandbox_key_missing/);
assert.match(source,/safe2pay_sandbox_key_matches_production/);
assert.doesNotMatch(source,/env\("SAFE2PAY_API_KEY_SANDBOX"\)\s*\|\|\s*productionApiKey\(\)/);
const stripped=source.replace(/^export\s+/gm,"");
const compiled=new Bun.Transpiler({loader:"ts",target:"browser"}).transformSync(stripped);
let count=0;
async function check(name,fn){await fn();count++;console.log("[OK] "+name);}
function fixture(config={}){
 const env={SAFE2PAY_PROVIDER_ENABLED:"1",
  SAFE2PAY_ENVIRONMENT:"sandbox",
  SAFE2PAY_API_KEY:"prod-fixture-key",
  SAFE2PAY_API_KEY_SANDBOX:"sandbox-fixture-key",
  SAFE2PAY_CALLBACK_URL:"https://callbacks.invalid/safe2pay",
  ...config};
 let calls=[];
 const context={
  Deno:{env:{get(k){return env[k]??null}}},
  fetch:async(url,options={})=>{
   calls.push({url,headers:options.headers??{},body:options.body??null});
   return {ok:true,status:200,async json(){return{ResponseDetail:{IdReceiver:42},HasError:false};}};
  },
  console,URL,encodeURIComponent,Number,Math,Object,String,Array,JSON,Date,Error,
 };
 vm.runInNewContext(compiled+"\nthis.apois={assertSafe2PayReady,createSafe2PayPix,createSafe2PaySubaccount,getSafe2PaySubaccount};",context,{filename:"safe2pay.ts"});
 return{api:context.apois,env,get calls(){return calls},
  pixInput:{reference:"apois-ride-fixture",vendor:"APOIS",customer:{Name:"QA",Identity:"00000000000"},
   products:[{Code:"ride",Description:"Ride test",UnitPrice:10,Quantity:1}],
   splits:[{IdReceiver:42,CodeTaxType:2,Amount:10,IsPayTax:false}]}
 };
}
async function rejectsBeforeFetch(name,config,run,expected) {
 await check(name,async()=>{
  const f=fixture(config);
  await assert.rejects(()=>run(f),new RegExp(expected));
  assert.equal(f.calls.length,0,"unexpected provider network request");
 });
}
await rejectsBeforeFetch("Unconfigured environment cannot create live Pix",
 {SAFE2PAY_ENVIRONMENT:""},
 f=>f.api.createSafe2PayPix(f.pixInput),"safe2pay_environment_explicitly_required");
await rejectsBeforeFetch("Sandbox environment cannot create real Pix",
 {},f=>f.api.createSafe2PayPix(f.pixInput),"safe2pay_pix_sandbox_not_confirmed");
await rejectsBeforeFetch("Unknown environment cannot become production Pix",
 {SAFE2PAY_ENVIRONMENT:"staging"},
 f=>f.api.createSafe2PayPix(f.pixInput),"safe2pay_environment_explicitly_required");
await rejectsBeforeFetch("Disabled provider cannot create Pix",
 {SAFE2PAY_ENVIRONMENT:"production",SAFE2PAY_PROVIDER_ENABLED:"0"},
 f=>f.api.createSafe2PayPix(f.pixInput),"safe2pay_provider_disabled");
await rejectsBeforeFetch("Sandbox subaccount without sandbox key never uses live key",
 {SAFE2PAY_API_KEY_SANDBOX:""},
 f=>f.api.createSafe2PaySubaccount({Name:"fixture"}),"safe2pay_sandbox_key_missing");
await rejectsBeforeFetch("Sandbox subaccount cannot use a key identical to production",
 {SAFE2PAY_API_KEY_SANDBOX:"prod-fixture-key"},
 f=>f.api.createSafe2PaySubaccount({Name:"fixture"}),"safe2pay_sandbox_key_matches_production");
await rejectsBeforeFetch("Sandbox subaccount lookup never falls back to live API key",
 {SAFE2PAY_API_KEY_SANDBOX:""},
 f=>f.api.getSafe2PaySubaccount(42),"safe2pay_sandbox_key_missing");
await rejectsBeforeFetch("Invalid environment blocks subaccount creation",
 {SAFE2PAY_ENVIRONMENT:"test"},
 f=>f.api.createSafe2PaySubaccount({Name:"fixture"}),"safe2pay_environment_explicitly_required");
await check("Sandbox subaccount creation uses only dedicated sandbox key",async()=>{
 const f=fixture();
 await f.api.createSafe2PaySubaccount({Name:"fixture"});
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].headers["X-API-KEY"],"sandbox-fixture-key");
 assert.match(f.calls[0].url,/marketplace\/add/);
});
await check("Sandbox subaccount lookup uses sandbox key",async()=>{
 const f=fixture();
 await f.api.getSafe2PaySubaccount(42);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].headers["X-API-KEY"],"sandbox-fixture-key");
 assert.match(f.calls[0].url,/marketplace\/get\?id=42/);
});
await check("Production subaccount lookup uses production credential",async()=>{
 const f=fixture({SAFE2PAY_ENVIRONMENT:"production"});
 await f.api.getSafe2PaySubaccount(42);
 assert.equal(f.calls[0].headers["X-API-KEY"],"prod-fixture-key");
});
await check("Production subaccount creation uses production credential",async()=>{
 const f=fixture({SAFE2PAY_ENVIRONMENT:"production"});
 await f.api.createSafe2PaySubaccount({Name:"fixture"});
 assert.equal(f.calls[0].headers["X-API-KEY"],"prod-fixture-key");
});
await check("Explicit production Pix uses production API and IsSandbox false (mock only)",async()=>{
 const f=fixture({SAFE2PAY_ENVIRONMENT:"production"});
 await f.api.createSafe2PayPix(f.pixInput);
 assert.equal(f.calls.length,1);
 assert.equal(f.calls[0].headers["X-API-KEY"],"prod-fixture-key");
 const payload=JSON.parse(f.calls[0].body);
 assert.equal(payload.IsSandbox,false);
 assert.equal(payload.PaymentMethod,"6");
});
await rejectsBeforeFetch("Pix item with fractional cents is rejected before any provider call",
 {SAFE2PAY_ENVIRONMENT:"production"},
 f=>f.api.createSafe2PayPix({...f.pixInput,
   products:[{Code:"ride",Description:"QA",UnitPrice:10.005,Quantity:1}]}),
 "safe2pay_fractional_cent_not_allowed");
await rejectsBeforeFetch("Pix marketplace split with fractional cents is rejected",
 {SAFE2PAY_ENVIRONMENT:"production"},
 f=>f.api.createSafe2PayPix({...f.pixInput,
   splits:[{IdReceiver:42,CodeTaxType:2,Amount:10.005,IsPayTax:false}]}),
 "safe2pay_fractional_cent_not_allowed");
await check("Exact cents and floating point representation are accepted without rounding value",async()=>{
 const f=fixture({SAFE2PAY_ENVIRONMENT:"production"});
 await f.api.createSafe2PayPix({...f.pixInput,
   products:[{Code:"one",Description:"QA",UnitPrice:0.1,Quantity:1},
     {Code:"two",Description:"QA",UnitPrice:0.2,Quantity:1}],
   splits:[{IdReceiver:42,CodeTaxType:2,Amount:0.3,IsPayTax:false}]});
 assert.equal(f.calls.length,1);
 assert.equal(JSON.parse(f.calls[0].body).PaymentMethod,"6");
});
console.log("[PASS] "+count+" isolated Safe2Pay environment isolation checks; no real provider requests.");
