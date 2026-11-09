"use strict";
/* APOIS Relatorio 03 (INV-042/043): Admin QA API, server-side only.
 * Never include privileged keys in the browser. No real message is sent by tests.
 * Requests >100 recipients are rejected rather than silently truncated.
 */
const BASE = "https://tbbzkrfupmqdywnzgnms.supabase.co";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AUDIENCES = new Set(["all","drivers","passengers","city","category","driver","passenger"]);
const FILTERED = new Set(["city","category","driver","passenger"]);
const LIMIT = 100;
function reply(res,status,payload){
  res.statusCode=status;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store, max-age=0");
  res.setHeader("X-Content-Type-Options","nosniff");
  res.end(JSON.stringify(payload));
}
function clean(value,max){return typeof value==="string"?value.trim().replace(/\s+/g," ").slice(0,max+1):"";}
async function upstream(path,headers,options={}){
  const response=await fetch(BASE+path,{...options,headers:{...headers,...options.headers},redirect:"error",signal:AbortSignal.timeout(10000)});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw Error("upstream_"+response.status);
  return data;
}
async function recipients(audience,filter,headers){
  const q=encodeURIComponent(filter||"");
  let path;
  if(audience==="all")path="/rest/v1/users?select=id&deleted_at=is.null&limit=101";
  else if(audience==="drivers")path="/rest/v1/drivers?select=user_id&limit=101";
  else if(audience==="passengers")path="/rest/v1/user_roles?select=user_id&role=eq.passenger&limit=101";
  else if(audience==="city")path="/rest/v1/users?select=id&deleted_at=is.null&city=ilike."+q+"&limit=101";
  else if(audience==="category")path="/rest/v1/drivers?select=user_id&category=eq."+q+"&limit=101";
  else if(audience==="driver"||audience==="passenger"){
    if(!UUID.test(filter||""))throw Error("invalid_filter");
    const own=await upstream("/rest/v1/users?select=id&id=eq."+q+"&deleted_at=is.null&limit=1",headers);
    if(Array.isArray(own)&&own.length===1)return [String(own[0].id)];
    const byAuth=await upstream("/rest/v1/users?select=id&auth_user_id=eq."+q+"&deleted_at=is.null&limit=1",headers);
    if(Array.isArray(byAuth)&&byAuth.length===1)return [String(byAuth[0].id)];
    if(audience==="driver"){
      const d=await upstream("/rest/v1/drivers?select=user_id&id=eq."+q+"&limit=1",headers);
      return Array.isArray(d)&&d.length===1?[String(d[0].user_id)]:[];
    }
    return [];
  }else throw Error("invalid_audience");
  const rows=await upstream(path,headers);
  if(!Array.isArray(rows))throw Error("invalid_recipient_result");
  // 101 database rows imply an unsafe audience, even if some are duplicated.
  if(rows.length>LIMIT)throw Error("too_many_recipients");
  const ids=[...new Set(rows.map(row=>String(row.id||row.user_id||"")).filter(id=>UUID.test(id)))];
  if(ids.length>LIMIT)throw Error("too_many_recipients");
  return ids;
}
module.exports=async function handler(req,res){
  if(req.method!=="GET"&&req.method!=="POST"){res.setHeader("Allow","GET, POST");return reply(res,405,{error:"method_not_allowed"});}
  const publicKey=process.env.CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY;
  const service=process.env.CORRIDAS_SUPABASE_SERVICE_ROLE_KEY;
  if(!publicKey||!service)return reply(res,503,{error:"admin_notifications_service_unconfigured"});
  const auth=String(req.headers?.authorization||"");
  if(!/^Bearer [^\s]{20,8192}$/.test(auth))return reply(res,401,{error:"unauthorized"});
  const publicHeaders={apikey:publicKey,Authorization:auth};
  const privileged={apikey:service,Authorization:"Bearer "+service};
  try{
    const user=await upstream("/auth/v1/user",publicHeaders);
    if(!UUID.test(user?.id||""))return reply(res,401,{error:"unauthorized"});
    // Match admin role_permissions gates; never rely on a role submitted by client.
    const profiles=await upstream("/rest/v1/profiles?select=role,active&user_id=eq."+user.id+"&active=eq.true&limit=1",privileged);
    const p=Array.isArray(profiles)&&profiles.length===1?profiles[0]:null;
    const role=typeof p?.role==="string"?p.role:"";
    if(p?.active!==true||!/^[a-z_]{2,40}$/.test(role))return reply(res,403,{error:"forbidden"});
    const grants=await upstream("/rest/v1/role_permissions?select=permission&role=eq."+encodeURIComponent(role)+"&permission=eq.notifications.send&limit=1",privileged);
    if(!Array.isArray(grants)||grants.length!==1||grants[0].permission!=="notifications.send")return reply(res,403,{error:"forbidden"});
    if(req.method==="GET"){
      const rows=await upstream("/rest/v1/notification_logs?select=id,event,channel,title,body,status,created_at,user_id&event=eq.admin.broadcast&order=created_at.desc&limit=100",privileged);
      if(!Array.isArray(rows))throw Error("invalid_history");
      return reply(res,200,rows);
    }
    const raw=typeof req.body==="string"?req.body:JSON.stringify(req.body||{});
    if(raw.length>4096)return reply(res,413,{error:"request_too_large"});
    let data;
    try{data=JSON.parse(raw);}catch{return reply(res,400,{error:"invalid_json"});}
    const title=clean(data?.title,100),body=clean(data?.body,500),filter=clean(data?.filter,120);
    const audience=data?.audience;
    if(!AUDIENCES.has(audience)||title.length<1||title.length>100||body.length<1||body.length>500)
      return reply(res,422,{error:"invalid_payload"});
    if(FILTERED.has(audience)&&!filter)return reply(res,422,{error:"missing_filter"});
    const ids=await recipients(audience,filter,privileged);
    if(ids.length===0)return reply(res,422,{error:"no_recipients"});
    if(ids.length>LIMIT)return reply(res,422,{error:"too_many_recipients",maximum:LIMIT});
    const response=await fetch(BASE+"/functions/v1/send-ride-push",{
      method:"POST",redirect:"error",signal:AbortSignal.timeout(30000),
      headers:{...privileged,"Content-Type":"application/json"},
      body:JSON.stringify({user_ids:ids,event:"admin.broadcast",title,body,url:"/notificacoes",
        data:{audience,audience_filter:filter}})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok||!result||typeof result!=="object")
      return reply(res,502,{error:"notification_delivery_failed"});
    return reply(res,200,{
      ok:result.ok===true,selected:ids.length,processed:Number(result.processed??0),
      sent:Number(result.sent??0),failed:Number(result.failed_users??result.failed??0),
      noTokens:Number(result.no_tokens??0),suppressed:Number(result.suppressed??0),
      partial:Number(result.partial_users??0)
    });
  }catch(error){
    if(error instanceof Error&&error.message==="too_many_recipients")
      return reply(res,422,{error:"too_many_recipients",maximum:LIMIT});
    if(error instanceof Error&&error.message==="invalid_filter")
      return reply(res,422,{error:"invalid_filter"});
    // Avoid leaking provider errors, private identifiers and server secrets.
    return reply(res,503,{error:"admin_notification_service_unavailable"});
  }
};
