// Experimental server-only Supabase Auth adapter. No default project,
// secrets, network calls at import, caching or production integration.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isId=v=>typeof v==="string"&&uuid.test(v);
const unavailable=()=>Error("Session verification unavailable");
function claims(token,issuer,t){
  if(typeof token!=="string"||token.length>8192||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))return null;
  try{
    const raw=token.split(".")[1],buf=Buffer.from(raw,"base64url");
    if(buf.toString("base64url")!==raw)return null;
    const p=JSON.parse(buf.toString("utf8"));
    if(!p||p.iss!==issuer||p.aud!=="authenticated"||p.role!=="authenticated"||
       !isId(p.sub)||!isId(p.session_id)||p.is_anonymous===true||
       !Number.isSafeInteger(p.exp)||!Number.isSafeInteger(p.iat)||p.iat>t||p.exp<=t||p.exp<=p.iat)return null;
    // Untrusted until the Auth server verifies the exact original token.
    return {sub:p.sub,sessionId:p.session_id,exp:p.exp};
  }catch{return null;}
}
async function boundedJson(response,signal){
  if(!response.body||!/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type")??"")||
    Number(response.headers.get("content-length"))>65536){await response.body?.cancel();throw unavailable();}
  const reader=response.body.getReader();let size=0;const chunks=[];
  try{
    for(;;){
      if(signal.aborted)throw unavailable();
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>65536)throw unavailable();
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }finally{try{await reader.cancel();}catch{}reader.releaseLock();}
}
export function createSupabaseSessionVerifier({projectUrl,publishableKey,sessionExists,fetchImpl=fetch,now=()=>Date.now(),timeoutMs=1800}={}){
  // Explicit trusted project configuration, no custom domains or redirects.
  if(typeof projectUrl!=="string"||!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(projectUrl)||
     typeof publishableKey!=="string"||!/^sb_publishable_[A-Za-z0-9_-]{10,200}$/.test(publishableKey)||
     typeof sessionExists!=="function"||typeof fetchImpl!=="function"||
     !Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>2000)throw Error("Invalid Auth adapter configuration");
  const issuer=new URL("/auth/v1",projectUrl).href,endpoint=issuer+"/user";
  return async(token,signal)=>{
    if(!(signal instanceof AbortSignal)||signal.aborted)return null;
    const t=Math.floor(now()/1000);
    if(!Number.isSafeInteger(t))throw unavailable();
    const p=claims(token,issuer,t);
    if(!p)return null;
    const combined=AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]);
    try{
      const response=await fetchImpl(endpoint,{method:"GET",redirect:"error",cache:"no-store",
        headers:{apikey:publishableKey,Authorization:"Bearer "+token,Accept:"application/json"},signal:combined});
      if(combined.aborted){await response.body?.cancel();throw unavailable();}
      if([401,403].includes(response.status)){await response.body?.cancel();return null;}
      if(response.status!==200||response.redirected){await response.body?.cancel();throw unavailable();}
      const user=await boundedJson(response,combined);
      if(!user||user.id!==p.sub||user.is_anonymous===true)return null;
      // Strict sign-out check. Must query current auth.sessions privately
      // by (id,user_id), and return literal true. No client metadata trust.
      if(await sessionExists(Object.freeze({authUserId:p.sub,sessionId:p.sessionId}),combined)!==true)return null;
      if(combined.aborted)throw unavailable();
      const end=Math.floor(now()/1000);
      if(!Number.isSafeInteger(end)||end<t||end>=p.exp)return null;
      return p.sub;
    }catch{throw unavailable();}
  };
}
