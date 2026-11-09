// INV-044: server-authorized reconciliation of a driver's own upload.
// No client Storage DELETE; no automatic object deletion on ambiguous RPC errors.
// Requires 20261109_report04_document_cleanup_queue_QA_NOT_APPLIED.sql deployed AFTER staging.
// Endpoint fails closed while that migration is missing.
import { createClient } from "npm:@supabase/supabase-js@2.112.1";
import { getCorsHeaders } from "../_shared/cors.ts";

type Payload = { slot?: unknown; bucket?: unknown; path?: unknown };
const SLOTS = new Set(["selfie","cnh_front","cnh_back","crlv","vehicle_photo"]);
const BUCKET_BY_SLOT: Record<string,string> = {
  selfie:"driver-selfies",cnh_front:"driver-cnh",cnh_back:"driver-cnh",
  crlv:"vehicle-documents",vehicle_photo:"vehicle-documents"
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function json(req:Request, body:Record<string,unknown>, status=200):Response {
  return new Response(JSON.stringify(body),{
    status,headers:{...getCorsHeaders(req),"content-type":"application/json; charset=utf-8",
      "cache-control":"no-store","x-content-type-options":"nosniff"}
  });
}
Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response(null,{headers:getCorsHeaders(req)});
  if(req.method!=="POST")return json(req,{error:"method_not_allowed"},405);
  const auth=(req.headers.get("Authorization")??"").match(/^Bearer ([^\s]{20,8192})$/);
  if(!auth)return json(req,{error:"unauthorized"},401);
  const url=Deno.env.get("SUPABASE_URL")??"";
  const serviceKey=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"";
  if(!url||!serviceKey)return json(req,{error:"reconcile_unavailable"},503);
  let body:Payload;
  try{
    if(Number(req.headers.get("content-length")??0)>2048)return json(req,{error:"request_too_large"},413);
    const raw=await req.text();
    if(raw.length>2048)return json(req,{error:"request_too_large"},413);
    body=JSON.parse(raw) as Payload;
  }catch{return json(req,{error:"invalid_json"},400);}
  const slot=typeof body.slot==="string"?body.slot:"";
  const bucket=typeof body.bucket==="string"?body.bucket:"";
  const path=typeof body.path==="string"?body.path:"";
  if(!SLOTS.has(slot)||bucket!==BUCKET_BY_SLOT[slot]||path.length>255||path.length<30)
    return json(req,{error:"invalid_document"},422);
  const client=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  try{
    const {data:identity,error:authError}=await client.auth.getUser(auth[1]);
    const authUserId=identity.user?.id;
    if(authError||!authUserId||!UUID.test(authUserId))return json(req,{error:"unauthorized"},401);
    // Path tied to the verified session and the original library naming contract.
    const suffix=path.startsWith(authUserId+"/")?path.slice(authUserId.length+1):"";
    if(!new RegExp("^"+slot+"-[0-9]{13}\\.(jpg|png|webp|pdf)$").test(suffix)||
        ((slot==="selfie"||slot==="vehicle_photo")&&suffix.endsWith(".pdf")))
      return json(req,{error:"not_owner_or_invalid_path"},403);
    // The RPC checks the object and its owner, locks the domain driver row and
    // persistently classifies linked, retained evidence or pending review.
    const {data,error}=await client.rpc("apois_driver_document_reconcile_candidate",{
      _auth_id:authUserId,_slot:slot,_bucket:bucket,_path:path
    });
    if(error||!data||typeof data!=="object")
      return json(req,{error:"reconcile_unavailable"},503);
    const status=(data as {status?:unknown}).status;
    if(status==="not_found")return json(req,{status:"not_found",recorded:false},404);
    if(status!=="linked"&&status!=="pending"&&status!=="retained_evidence")
      return json(req,{error:"reconcile_invalid_result"},503);
    const recorded=(data as {recorded?:unknown}).recorded===true;
    if(!recorded)return json(req,{error:"reconcile_unrecorded"},503);
    if(status==="linked"){
      const result=(data as {result?:unknown}).result;
      if(!result||typeof result!=="object")return json(req,{error:"reconcile_missing_link"},503);
      return json(req,{status,recorded,result},200);
    }
    return json(req,{status,recorded},200);
  }catch{
    return json(req,{error:"reconcile_unavailable"},503);
  }
});
