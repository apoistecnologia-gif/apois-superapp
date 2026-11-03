// APOIS ENTREGAS — Cash-only QA of the REAL TypeScript create-order Edge handler.
// Isolated in-memory Supabase mocks; no provider, network, money, or DB changes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

const file="supabase/functions/create-order/index.ts";
const raw=readFileSync(file,"utf8");
assert.match(raw,/const PAYMENT_METHODS = new Set\(\["cash"\]\)/);
assert.doesNotMatch(raw,/functions\.invoke\(|https:\/\/payment\.safe2pay\.com\.br|paymentMethod:\s*"pix"/);
const stripped=raw.replace(/^import \{ createClient \} from "npm:@supabase\/supabase-js@[^"]+";\s*/,"");
assert.notEqual(stripped,raw,"Expected pinned npm import for isolated test");
const compiled=new Bun.Transpiler({loader:"ts",target:"browser"}).transformSync(stripped);

const CUSTOMER="11111111-1111-4111-8111-111111111111";
const MERCHANT="22222222-2222-4222-8222-222222222222";
const PRODUCT="33333333-3333-4333-8333-333333333333";
const ADDRESS="44444444-4444-4444-8444-444444444444";
const REQUEST="55555555-5555-4555-8555-555555555555";
const ORDER="66666666-6666-4666-8666-666666666666";

const payload={
 merchantId:MERCHANT,requestKey:REQUEST,paymentMethod:"cash",
 fulfillmentType:"pickup",items:[{productId:PRODUCT,quantity:1,options:[]}],
};
const snapshot={
 id:ORDER,order_number:1001,status:"confirmed",payment_method:"cash",
 payment_status:"pending",fulfillment_type:"pickup",coupon_id:null,
 created_at:"2026-11-03T00:00:00Z",subtotal:18.5,delivery_fee:0,
 discount:0,total:18.5,observation:null,order_items:[],
};
let tests=0;
function fixture(settings={}){
 const calls=[];
 let handler;
 const env={
  SUPABASE_URL:"https://sandbox.invalid",
  SUPABASE_ANON_KEY:"anon-fixture",
  SUPABASE_SERVICE_ROLE_KEY:"server-fixture",
  ...settings.env,
 };
 const user=settings.user===undefined?{id:CUSTOMER}:settings.user;
 const snapshotData={...snapshot,...settings.snapshot};
 const address=settings.address===undefined?{
  id:ADDRESS,label:"Casa",street:"Rua",number:"1",complement:null,
  neighborhood:"Centro",city:"Cidade",state:"PE",postal_code:"00000000",
  reference:null,latitude:-9.4,longitude:-40.5}:settings.address;
 const createClient=(url,key)=>{
  assert.equal(url,env.SUPABASE_URL);
  if(key==="anon-fixture")return{auth:{getUser:async token=>{
   calls.push(["auth",token]);
   return {data:{user},error:user?null:{message:"missing"}};
  }}};
  assert.equal(key,"server-fixture","Unexpected provider credential or key");
  return{
   rpc:async(name,args)=>{
    calls.push(["rpc",name,args]);
    assert.equal(name,"create_order_for_checkout_intent_v2");
    if(settings.rpcError)return{data:null,error:{message:settings.rpcError,code:"P0001"}};
    return{data:[{order_id:ORDER,order_number:1001}],error:null};
   },
   from:table=>{
    calls.push(["from",table]);
    assert.ok(["orders","customer_addresses"].includes(table),"Unexpected table access");
    const query={select(){return this},eq(){return this},
     async maybeSingle(){assert.equal(table,"customer_addresses");return{data:address,error:null}},
     async single(){assert.equal(table,"orders");return{data:snapshotData,error:null}}};
    return query;
   }
  };
 };
 vm.runInNewContext(compiled,{
  Deno:{env:{get:k=>env[k]??null},serve:fn=>{handler=fn}},
  createClient,Request,Response,Headers,URL,TextEncoder,crypto:webcrypto,
  console:{error(){},warn(){},log(){}},Map,Set,Array,Object,Number,String,
  JSON,Math,Uint8Array,Error,Date,Boolean,
 },{filename:file,timeout:4000});
 assert.equal(typeof handler,"function");
 return{
  calls,
  async send(body=payload,{method="POST",auth=true,json=true}={}){
   const request=new Request("https://sandbox.invalid/functions/v1/create-order",{
    method,headers:auth?{Authorization:"Bearer synthetic-session-do-not-use",...(json?{"Content-Type":"application/json"}:{})}:{},
    ...(method==="POST"?{body:json?JSON.stringify(body):String(body)}:{})
   });
   const response=await handler(request);
   return{status:response.status,body:response.status===204?null:await response.json()};
  }
 };
}
async function check(label,fn){await fn();tests++;console.log("[OK] "+label)}
function noProviderCalls(f){
 assert.equal(f.calls.filter(x=>!["auth","rpc","from"].includes(x[0])).length,0);
 assert.equal(f.calls.filter(x=>x[0]==="rpc").some(x=>x[1].includes("safe2pay")||x[1].includes("pix")),false);
}
await check("Cash pickup stays pending; price comes from backend snapshot",async()=>{
 const f=fixture();const r=await f.send();
 assert.equal(r.status,200);assert.equal(r.body.paymentMethod,"cash");
 assert.equal(r.body.paymentStatus,"pending");assert.equal(r.body.total,18.5);
 const rpc=f.calls.find(x=>x[0]==="rpc");
 assert.equal(rpc[2].p_customer_user_id,CUSTOMER);
 assert.equal(rpc[2].p_payment_method,"cash");
 assert.equal(rpc[2].p_fulfillment_type,"pickup");
 assert.equal(rpc[2].p_items[0].productId,PRODUCT);
 noProviderCalls(f);
});
await check("Cash delivery uses saved address read owned by verified user",async()=>{
 const f=fixture();const r=await f.send({...payload,fulfillmentType:"delivery",deliveryAddress:{id:ADDRESS,latitude:0,longitude:0}});
 assert.equal(r.status,200);
 const rpc=f.calls.find(x=>x[0]==="rpc");
 assert.equal(rpc[2].p_delivery_address.latitude,-9.4);
 assert.equal(rpc[2].p_delivery_address.longitude,-40.5);
 noProviderCalls(f);
});
for(const bad of ["pix","credit","debit","wallet","card"]){
 await check("Reject unconfigured payment type "+bad,async()=>{
  const f=fixture();const r=await f.send({...payload,paymentMethod:bad});
  assert.equal(r.status,400);assert.equal(r.body.code,"PAYMENT_METHOD_NOT_CONFIGURED");
  assert.equal(f.calls.filter(c=>c[0]==="rpc").length,0);
  noProviderCalls(f);
 });
}
await check("Missing bearer cannot use server RPC",async()=>{
 const f=fixture();const r=await f.send(payload,{auth:false});
 assert.equal(r.status,401);assert.equal(f.calls.length,0);
});
await check("Invalid authentication cannot create any order",async()=>{
 const f=fixture({user:null});const r=await f.send();
 assert.equal(r.status,401);assert.equal(f.calls.filter(c=>c[0]==="rpc").length,0);
});
await check("Empty cart is rejected before RPC",async()=>{
 const f=fixture();const r=await f.send({...payload,items:[]});
 assert.equal(r.status,400);assert.equal(f.calls.filter(c=>c[0]==="rpc").length,0);
});
await check("Negative quantity is rejected before RPC",async()=>{
 const f=fixture();const r=await f.send({...payload,items:[{productId:PRODUCT,quantity:-1,options:[]}]});
 assert.equal(r.status,400);assert.equal(f.calls.filter(c=>c[0]==="rpc").length,0);
});
await check("Unowned delivery address cannot create order",async()=>{
 const f=fixture({address:null});const r=await f.send({...payload,fulfillmentType:"delivery",deliveryAddress:{id:ADDRESS}});
 assert.equal(r.status,400);assert.equal(r.body.code,"DELIVERY_ADDRESS_NOT_FOUND");
 assert.equal(f.calls.filter(c=>c[0]==="rpc").length,0);
});
await check("Missing delivery coordinates block dispatch",async()=>{
 const f=fixture({address:{...fixtureAddress(),latitude:null}});const r=await f.send({...payload,fulfillmentType:"delivery",deliveryAddress:{id:ADDRESS}});
 assert.equal(r.status,400);assert.equal(r.body.code,"DELIVERY_COORDINATES_REQUIRED");
});
function fixtureAddress(){return{id:ADDRESS,latitude:-9.4,longitude:-40.5}}
await check("Merchant closed is returned as 409, not a successful order",async()=>{
 const f=fixture({rpcError:"merchant is closed"});const r=await f.send();
 assert.equal(r.status,409);assert.equal(r.body.code,"MERCHANT_CLOSED");
});
await check("Backend cannot claim cash is electronically paid",async()=>{
 const f=fixture({snapshot:{payment_status:"paid"}});const r=await f.send();
 assert.equal(r.status,500);assert.equal(r.body.code,"FINANCIAL_CONTRACT_MISMATCH");
});
for(const invalidStatus of ["cancelled","failed","refunded","processing"]){
 await check("Reject unexpected cash order snapshot status "+invalidStatus,async()=>{
  const f=fixture({snapshot:{payment_status:invalidStatus}});
  const r=await f.send();
  assert.equal(r.status,500);
  assert.equal(r.body.code,"FINANCIAL_CONTRACT_MISMATCH");
  noProviderCalls(f);
 });
}
for (const terminalStatus of ["cancelled", "refunded", "delivered"]) {
 await check("Cash order in terminal state " + terminalStatus + " cannot be returned as fresh checkout",async()=>{
  const f=fixture({snapshot:{status:terminalStatus,payment_status:"pending"}});
  const r=await f.send();
  assert.equal(r.status,500);
  assert.equal(r.body.code,"FINANCIAL_CONTRACT_MISMATCH");
  noProviderCalls(f);
 });
}
await check("Nonterminal cash order remains resumable without gateway",async()=>{
 const f=fixture({snapshot:{status:"preparing",payment_status:"pending"}});
 const r=await f.send();
 assert.equal(r.status,200);
 assert.equal(r.body.status,"preparing");
 noProviderCalls(f);
});
await check("Backend cannot transform cash request into Pix",async()=>{
 const f=fixture({snapshot:{payment_method:"pix"}});const r=await f.send();
 assert.equal(r.status,500);assert.equal(r.body.code,"FINANCIAL_CONTRACT_MISMATCH");
});
await check("Invalid request method is rejected",async()=>{
 const f=fixture();const r=await f.send(null,{method:"GET",auth:false});
 assert.equal(r.status,405);assert.equal(f.calls.length,0);
});
await check("OPTIONS preflight is safe and does not call providers",async()=>{
 const f=fixture();const r=await f.send(null,{method:"OPTIONS",auth:false});
 assert.equal(r.status,204);assert.equal(f.calls.length,0);
});
await check("Absent server secret fails closed",async()=>{
 const f=fixture({env:{SUPABASE_SERVICE_ROLE_KEY:""}});const r=await f.send();
 assert.equal(r.status,500);assert.equal(r.body.code,"SERVER_CONFIGURATION");
 assert.equal(f.calls.length,0);
});
console.log("[PASS] "+tests+" isolated cash-order Edge handler checks; no real financial transactions.");
