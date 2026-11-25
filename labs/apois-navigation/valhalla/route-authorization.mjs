// Lab verification of one-use, short-lived route-specific capabilities.
// A future trusted issuer must independently verify identity, assignment,
// category, destination provenance and scope BEFORE signing. No issuer API,
// Supabase session, key file, secret, credential logging or production config.
import {createHash,verify} from "node:crypto";

const tokenId=/^[A-Za-z0-9_-]{22,64}$/;
const hash=/^[a-f0-9]{64}$/;
const fields=["aud","iat","exp","jti","sub","route"];
const exact=o=>o&&typeof o==="object"&&!Array.isArray(o)&&Object.keys(o).length===fields.length&&fields.every(k=>Object.hasOwn(o,k));
export function routeDigest(normalized){
  return createHash("sha256").update(JSON.stringify(normalized),"utf8").digest("hex");
}
function decode(s,max){
  if(typeof s!=="string"||s.length>max||!s.length||!/^[A-Za-z0-9_-]+$/.test(s))return null;
  const b=Buffer.from(s,"base64url");
  return b.toString("base64url")===s?b:null;
}
// Opaque sub must be assigned by the issuer (same pseudonymous principal
// across permits), never an account token or raw rider/driver ID.
// All mutable state is bounded and process-local. A restart loses replay
// history; a real deployment MUST supply shared atomic replay/quota storage.
export function createRouteAuthorization({publicKey,audience,now=()=>Date.now(),
  maxEntries=4096,maxPrincipals=1024,perMinute=6,parallel=1,store=null}){
  if(publicKey?.type!=="public"||publicKey.asymmetricKeyType!=="ed25519"||
    typeof audience!=="string"||!audience||audience.length>128||
    ![maxEntries,maxPrincipals,perMinute,parallel].every(n=>Number.isInteger(n)&&n>0)||
    (store!==null&&typeof store.admit!=="function"))throw Error("Invalid lab authorization configuration");
  const consumed=new Map(),principals=new Map();
  let last=0;
  return function authorize(header,body){
    const t=now();
    if(!Number.isSafeInteger(t)||t<last)return {status:503};
    last=t;
    if(typeof header!=="string"||header.length>2048||!header.startsWith("Bearer "))return {status:401};
    const pieces=header.slice(7).split(".");
    if(pieces.length!==2)return {status:401};
    const raw=decode(pieces[0],1500),sig=decode(pieces[1],128);
    if(!raw||!sig||sig.length!==64||!verify(null,raw,publicKey,sig))return {status:401};
    let claim;
    try{claim=JSON.parse(raw.toString("utf8"));}catch{return {status:401};}
    if(!exact(claim)||claim.aud!==audience||
      typeof claim.jti!=="string"||typeof claim.sub!=="string"||typeof claim.route!=="string"||
      !tokenId.test(claim.jti)||!hash.test(claim.sub)||!hash.test(claim.route)||
      !Number.isSafeInteger(claim.iat)||!Number.isSafeInteger(claim.exp)||
      claim.iat<0||claim.iat>t||claim.exp<=t||claim.exp<=claim.iat||claim.exp-claim.iat>30_000||
      claim.route!==routeDigest(body))return {status:403};
    // Only authenticated claims can enter the optional atomic store.
    // Storage failure must not silently fall back to process memory.
    if(store){
      try{return store.admit({jti:claim.jti,sub:claim.sub,exp:claim.exp},t);}
      catch{return {status:503};}
    }
    for(const [id,exp] of consumed)if(exp<=t)consumed.delete(id);
    if(consumed.has(claim.jti))return {status:403};
    for(const [id,p] of principals){
      p.starts=p.starts.filter(start=>t-start<60_000);
      if(!p.starts.length&&!p.active)principals.delete(id);
    }
    if(consumed.size>=maxEntries)return {status:429};
    let p=principals.get(claim.sub);
    if(!p){
      if(principals.size>=maxPrincipals)return {status:429};
      p={starts:[],active:0};principals.set(claim.sub,p);
    }
    if(p.starts.length>=perMinute||p.active>=parallel)return {status:429};
    // Consume before forwarding; even an upstream error cannot retry this permit.
    consumed.set(claim.jti,claim.exp);p.starts.push(t);p.active++;
    let released=false;
    return {status:200,release(){if(!released){released=true;p.active--;}}};
  };
}
