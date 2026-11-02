"use strict";
/* APOIS_ADMIN_PREVIEW_PRIVATE_DOCS_V1
 * Isolated Vercel QA function; no client-side service key; no production deployment.
 * Fails closed until CORRIDAS_SUPABASE_SERVICE_ROLE_KEY is securely configured.
 * All signed URLs expire after ten minutes. No permanent document URLs.
 */
const URL_BASE = "https://tbbzkrfupmqdywnzgnms.supabase.co";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLOTS = [
  ["selfie_url", "driver-selfies"],
  ["cnh_url", "driver-cnh"],
  ["cnh_back_url", "driver-cnh"],
  ["vehicle_document_url", "vehicle-documents"],
  ["vehicle_photo_url", "vehicle-documents"],
];
const ALLOWED_INSPECTION_SLOTS = new Set([
  "front","right","left","dashboard","front_seats","rear_seats",
  "tire_fl","tire_fr","tire_rl","tire_rr","belt_front","belt_rear","headlights_on",
]);

function reply(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(payload));
}
function storagePath(raw, owner) {
  if (typeof raw !== "string" || !raw.startsWith(owner + "/") || raw.length > 512) return null;
  if (!/^[a-zA-Z0-9_./-]+$/.test(raw) || raw.includes("..") || raw.includes("//")) return null;
  return raw;
}
function encPath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}
async function jsonFetch(url, options) {
  const response = await fetch(url, { ...options, redirect: "error", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("upstream_" + response.status);
  return response.json();
}
async function signer(bucket, rawPath, owner, service) {
  const path = storagePath(rawPath, owner);
  if (!path) return null;
  const data = await jsonFetch(
    URL_BASE + "/storage/v1/object/sign/" + encodeURIComponent(bucket) + "/" + encPath(path),
    { method: "POST", headers: {
        apikey: service, Authorization: "Bearer " + service,
        "Content-Type": "application/json"
      }, body: JSON.stringify({ expiresIn: 600 }) }
  );
  const relative = data.signedURL || data.signedUrl;
  if (typeof relative !== "string") throw new Error("signing_missing_result");
  const final = new URL(relative.startsWith("/object/sign/") ? "/storage/v1" + relative : relative, URL_BASE);
  if (final.origin !== URL_BASE || !final.pathname.startsWith("/storage/v1/object/sign/"))
    throw new Error("signing_untrusted_response");
  return final.toString();
}
module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return reply(res,405,{error:"method_not_allowed"}); }
  const publishable = process.env.CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY;
  const service = process.env.CORRIDAS_SUPABASE_SERVICE_ROLE_KEY;
  if (!publishable || !service) return reply(res,503,{error:"preview_document_service_unconfigured"});
  const auth = String(req.headers?.authorization || "");
  if (!/^Bearer [^\s]{20,8192}$/.test(auth)) return reply(res,401,{error:"unauthorized"});
  const requestContent = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (requestContent.length > 1024) return reply(res,413,{error:"request_too_large"});
  let payload;
  try { payload=JSON.parse(requestContent); } catch { return reply(res,400,{error:"invalid_json"}); }
  const id=payload?.driverId;
  if (typeof id !== "string" || !UUID.test(id)) return reply(res,400,{error:"invalid_driver_id"});
  const common={ apikey:publishable, Authorization:auth, "Content-Type":"application/json" };
  try {
    const user=await jsonFetch(URL_BASE + "/auth/v1/user",{headers:common});
    if (!UUID.test(user?.id||"")) return reply(res,401,{error:"unauthorized"});
    // Database policy private.has_permission() uses active public.profiles + role_permissions.
    // Verify the same contract server-side using service-only queries, never client claims.
    const secretHeaders={apikey:service,Authorization:"Bearer "+service};
    const adminProfiles=await jsonFetch(
      URL_BASE + "/rest/v1/profiles?select=role,active&user_id=eq."+user.id+"&active=eq.true&limit=1",
      {headers:secretHeaders});
    const activeProfile=Array.isArray(adminProfiles)&&adminProfiles.length===1 ? adminProfiles[0] : null;
    const role=typeof activeProfile?.role==="string"?activeProfile.role:"";
    if (!/^[a-z_]{2,40}$/.test(role) || activeProfile.active!==true)
      return reply(res,403,{error:"forbidden"});
    const grants=await jsonFetch(
      URL_BASE + "/rest/v1/role_permissions?select=permission&role=eq."+encodeURIComponent(role)+"&permission=eq.drivers.read&limit=1",
      {headers:secretHeaders});
    if (!Array.isArray(grants)||grants.length!==1||grants[0].permission!=="drivers.read")
      return reply(res,403,{error:"forbidden"});

    const drivers=await jsonFetch(URL_BASE + "/rest/v1/drivers?select=user_id,selfie_url,cnh_url,cnh_back_url,vehicle_document_url,vehicle_photo_url&id=eq."+id+"&limit=1",{headers:secretHeaders});
    if (!Array.isArray(drivers) || drivers.length!==1) return reply(res,404,{error:"driver_not_found"});
    const driver=drivers[0];
    if (!UUID.test(driver?.user_id||"")) return reply(res,409,{error:"driver_identity_unavailable"});
    const owners=await jsonFetch(URL_BASE + "/rest/v1/users?select=auth_user_id&id=eq."+driver.user_id+"&limit=1",{headers:secretHeaders});
    const owner=Array.isArray(owners)&&owners.length===1 ? owners[0].auth_user_id : null;
    if (!UUID.test(owner||"")) return reply(res,409,{error:"driver_identity_unavailable"});

    const documents={};
    for(const [field,bucket] of SLOTS)
      documents[field]=driver[field] ? await signer(bucket,driver[field],owner,service) : null;

    const encodedId=encodeURIComponent(id);
    const photos=await jsonFetch(URL_BASE+"/rest/v1/apois_vehicle_inspection_photos?select=id,slot,bucket_id,object_path,review_status,review_note,submitted_at&driver_id=eq."+encodedId+"&order=submitted_at.desc&limit=40",{headers:secretHeaders});
    if (!Array.isArray(photos)) throw new Error("invalid_inspection_result");
    const seen=new Set();
    const inspection=[];
    for(const item of photos) {
      if (!UUID.test(item?.id||"") || !ALLOWED_INSPECTION_SLOTS.has(item?.slot) || seen.has(item.slot)) continue;
      seen.add(item.slot);
      if (item.bucket_id !== "apois-inspections") throw new Error("unexpected_inspection_bucket");
      inspection.push({
        id:item.id,slot:item.slot,url:await signer(item.bucket_id,item.object_path,owner,service),
        review_status:String(item.review_status||"pending"),review_note:item.review_note||null,
        submitted_at:item.submitted_at||null
      });
    }
    return reply(res,200,{...documents,inspection_photos:inspection});
  } catch {
    // Never expose upstream errors, signed URLs or user/session tokens in logs.
    return reply(res,502,{error:"preview_documents_unavailable"});
  }
};
