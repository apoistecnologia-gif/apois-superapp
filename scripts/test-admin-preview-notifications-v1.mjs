// Synthetic, fully mocked Admin endpoint regression: no real network or push.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const handler=require("../api/admin/notifications.js");
process.env.CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY="test-public-key";
process.env.CORRIDAS_SUPABASE_SERVICE_ROLE_KEY="test-service-role-key";
const userId="10000000-0000-4000-8000-000000000001";
const ids=Array.from({length:150},(_,i)=>"20000000-0000-4000-8000-"+String(i+1).padStart(12,"0"));
const bearer="Bearer "+("a".repeat(80));
let authorized=true,grant=true,people=[],pushCount=0,activeToken=true,calls=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async(url,opts={})=>{
  const path=String(url);
  calls.push({path,method:opts.method||"GET"});
  const wrap=(data,status=200)=>({ok:status>=200&&status<300,status,async json(){return data;}});
  if(path.includes("/auth/v1/user"))return authorized?wrap({id:userId}):wrap({},401);
  if(path.includes("/rest/v1/profiles?"))return wrap([{role:"operations_admin",active:true}]);
  if(path.includes("/rest/v1/role_permissions?"))return wrap(grant?[{permission:"notifications.send"}]:[]);
  if(path.includes("/rest/v1/notification_logs?"))return wrap([{id:ids[0],event:"admin.broadcast",channel:"fcm",title:"Aviso",body:null,status:"sent",created_at:"2026-11-08T00:00:00Z",user_id:ids[0]}]);
  if(path.includes("/rest/v1/users?"))return wrap(people.slice(0,101).map(id=>({id})));
  if(path.includes("/functions/v1/send-ride-push")){
    pushCount++;
    assert.equal(opts.method,"POST");
    const body=JSON.parse(opts.body);
    assert.equal(body.event,"admin.broadcast");
    assert(body.user_ids.length<=100);
    assert.equal(opts.headers.Authorization,"Bearer test-service-role-key");
    return wrap({ok:true,processed:body.user_ids.length,sent:body.user_ids.length,failed_users:0,no_tokens:0,suppressed:0});
  }
  throw Error("Unexpected mock URL: "+path);
};
async function invoke(method="GET",body=null,token=bearer){
 let status=200,payload=null;
 const res={statusCode:200,setHeader(){},end(body){status=this.statusCode;payload=JSON.parse(body);}};
 await handler({method,headers:token?{authorization:token}:{},body},res);
 return {status,payload};
}
let passed=0;
function check(condition,label){assert(condition,label);passed++;}
try{
 let r=await invoke("GET",null,"");
 check(r.status===401&&pushCount===0,"anon denied");
 grant=false;
 r=await invoke();
 check(r.status===403&&pushCount===0,"ordinary role denied");
 grant=true;
 r=await invoke();
 check(r.status===200&&Array.isArray(r.payload)&&r.payload.length===1&&pushCount===0,"history reads only");
 const request={title:"Aviso",body:"Teste sintético",audience:"all",filter:null};
 people=[];
 r=await invoke("POST",request);
 check(r.status===422&&r.payload.error==="no_recipients"&&pushCount===0,"zero audience");
 people=[ids[0]];
 r=await invoke("POST",request);
 check(r.status===200&&r.payload.selected===1&&pushCount===1,"one recipient");
 people=ids.slice(0,100);
 r=await invoke("POST",request);
 check(r.status===200&&r.payload.selected===100&&pushCount===2,"100 recipients");
 people=ids.slice(0,101);
 r=await invoke("POST",request);
 check(r.status===422&&r.payload.error==="too_many_recipients"&&pushCount===2,"101 rejected with no push");
 people=ids;
 r=await invoke("POST",request);
 check(r.status===422&&r.payload.error==="too_many_recipients"&&pushCount===2,"150 rejected with no push");
 r=await invoke("POST",{...request,title:""});
 check(r.status===422&&pushCount===2,"invalid payload no send");
 r=await invoke("PUT");
 check(r.status===405&&pushCount===2,"unknown method denied");
 // Failure pathway must not pretend HTML fallback was JSON/history.
 console.log("[OK] INV-042/043 mock endpoint "+passed+" assertions; no external requests");
}catch(error){console.error("[FAIL] report03 admin mock",error);process.exitCode=1;}
finally{globalThis.fetch=originalFetch;}
