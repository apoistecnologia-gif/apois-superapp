import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const handler=require("../admin-preview/api/admin/driver-documents.js");
const keys=["CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY","CORRIDAS_SUPABASE_SERVICE_ROLE_KEY"];
const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
const priorFetch=globalThis.fetch;
const userId="89abd75b-02d7-490f-ad13-7ee3b8906196";
const driverId="f0131b8c-2d02-4596-9035-72b4b9b8bd1f";
const ownerId="85d6923a-d547-4166-8995-7d3a6a74a8ad";
const jwt="test-public-user-token-"+ "x".repeat(50);
function response(data,status=200){return {ok:status>=200&&status<300,status,json:async()=>data};}
async function invoke({method="POST",auth="Bearer "+jwt,body={driverId}}={}){
 const res={headers:{},statusCode:0,body:"",setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(str){this.body=str;}};
 await handler({method,headers:{authorization:auth},body},res);
 return {status:res.statusCode,headers:res.headers,body:JSON.parse(res.body)};
}
try{
 delete process.env.CORRIDAS_SUPABASE_SERVICE_ROLE_KEY;
 process.env.CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY="test_public_anon";
 assert.equal((await invoke({method:"GET"})).status,405,"other methods must be rejected");
 assert.equal((await invoke()).status,503,"unconfigured private service must fail closed");
 process.env.CORRIDAS_SUPABASE_SERVICE_ROLE_KEY="test_service_role_qa";
 assert.equal((await invoke({auth:"Bearer x"})).status,401,"missing session must be rejected");
 assert.equal((await invoke({body:{driverId:"../../another-user"}})).status,400,"invalid driver ID must be rejected");

 let permission=false,signs=0,requests=[];
 globalThis.fetch=async(url,options={})=>{
  const u=String(url);requests.push({url:u,headers:options.headers,method:options.method});
  if(u.endsWith("/auth/v1/user"))return response({id:userId});
  if(u.includes("/rest/v1/profiles?"))return response([{role:"admin",active:true}]);
  if(u.includes("/rest/v1/role_permissions?"))return response(permission?[{permission:"drivers.read"}]:[]);
  if(u.includes("/rest/v1/drivers?"))return response([{user_id:userId,selfie_url:ownerId+"/profile.jpg",cnh_url:null,cnh_back_url:null,vehicle_document_url:null,vehicle_photo_url:null}]);
  if(u.includes("/rest/v1/users?"))return response([{auth_user_id:ownerId}]);
  if(u.includes("/rest/v1/apois_vehicle_inspection_photos?"))return response([{id:driverId,slot:"front",bucket_id:"apois-inspections",object_path:ownerId+"/front.jpg",review_status:"pending",review_note:null,submitted_at:"2026-11-02T14:00:00Z"}]);
  if(u.includes("/storage/v1/object/sign/")){signs++;return response({signedURL:"/object/sign/driver-selfies/profile.jpg?token=synthetic-nonsecret"});}
  throw Error("unexpected_mock_url");
 };
 assert.equal((await invoke()).status,403,"non-admin must not get signed URLs");
 assert.equal(signs,0,"no signing before authorization");
 permission=true;
 const yes=await invoke();
 assert.equal(yes.status,200,JSON.stringify(yes.body));
 assert.equal(yes.body.inspection_photos.length,1);
 assert.match(yes.body.selfie_url,/^https:\/\/tbbzkrfupmqdywnzgnms\.supabase\.co\/storage\/v1\/object\/sign\//);
 assert.equal(signs,2);
 assert.equal(yes.headers["cache-control"],"private, no-store, max-age=0");
 assert.ok(requests.some(x=>x.url.includes("/rest/v1/profiles?")&&x.headers?.Authorization==="Bearer test_service_role_qa"));
 assert.ok(requests.some(x=>x.url.includes("/rest/v1/role_permissions?")&&x.headers?.Authorization==="Bearer test_service_role_qa"));
 assert.ok(requests.filter(x=>x.url.includes("/rest/v1/drivers?")).every(x=>x.headers.Authorization==="Bearer test_service_role_qa"));
 assert.equal(JSON.stringify(yes.body).includes("test_service_role_qa"),false);
 assert.equal(JSON.stringify(yes.body).includes(jwt),false);
 console.log("[OK] Admin QA document endpoint: 405, 503, 401, 400, 403; staff-only ten-minute signed URL + private cache.");
}finally{
 globalThis.fetch=priorFetch;
 for(const key of keys){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}
}
