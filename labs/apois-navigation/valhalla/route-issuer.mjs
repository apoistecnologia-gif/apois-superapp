// Lab server-side issuer. No HTTP listener, production credentials, database,
// or default identity adapter. The injected authority MUST authenticate and
// load independent, server-owned evidence, not echo client-supplied fields.
import {createHmac,randomBytes,sign} from "node:crypto";
import {normalizeRoute} from "./route-gateway.mjs";
import {routeDigest} from "./route-authorization.mjs";
import {inside,valeContains} from "./region-policy.mjs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isId=v=>typeof v==="string"&&uuid.test(v);
const exact=(o,keys)=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const point=(p,contains)=>exact(p,["lat","lon"])&&inside(contains,p.lat,p.lon);
const status={PICKUP:"motorista_a_caminho",TRIP:"em_viagem"};
// Only a trusted lifecycle adapter may derive/revoke a scope. A separate
// domain makes the pseudonym distinct from the driver quota identifier.
// This deliberately revokes the entire ride leg, including reassignments.
export function routeLegScope(key,audience,rideId,phase){
  if(!Buffer.isBuffer(key)||key.length<32||typeof audience!=="string"||!audience||audience.length>128||
    !isId(rideId)||typeof phase!=="string"||!Object.hasOwn(status,phase))throw Error("Invalid route leg scope");
  return createHmac("sha256",key).update(JSON.stringify(["apois-route-leg-v1",audience,rideId.toLowerCase(),phase])).digest("hex");
}
export function routeBody(origin,target,contains=valeContains){
  if(!point(origin,contains)||!point(target,contains))return null;
  return normalizeRoute({locations:[{...origin,type:"break"},{...target,type:"break"}],costing:"auto",units:"kilometers",language:"pt-BR",format:"osrm",voice_instructions:true,banner_instructions:true,shape_format:"polyline6"},contains);
}
export function verifiedRouteProof(proof,request,now,contains=valeContains){
  if(!proof||!isId(proof.authUserId)||!isId(proof.profileUserId)||!isId(proof.driverId)||
    proof.rideId!==request.rideId||proof.status!==status[request.phase]||
    (proof.acceptedDriverId??proof.assignedDriverId)!==proof.driverId||
    (proof.assignedDriverId!=null&&proof.assignedDriverId!==proof.driverId)||
    proof.category!=="carros"||proof.intermediateStops!==0||
    !Number.isSafeInteger(proof.verifiedAt)||proof.verifiedAt<0||proof.verifiedAt>now||now-proof.verifiedAt>5000)return null;
  const evidence=proof.targetEvidence;
  // The record is supplied by the trusted adapter, not by the caller.
  // Evidence ID/version must refer to independently acquired stored data;
  // this contract cannot prove how that record was originally obtained.
  if(!evidence||!isId(evidence.id)||!Number.isSafeInteger(evidence.version)||evidence.version<1||
    evidence.rideId!==request.rideId||evidence.phase!==request.phase||
    !["INDEPENDENT_GPS","INDEPENDENT_OSM"].includes(evidence.source)||!point(evidence.point,contains))return null;
  if(!point(request.target,contains)||request.target.lat!==evidence.point.lat||request.target.lon!==evidence.point.lon)return null;
  return routeBody(request.origin,evidence.point,contains);
}
export function createRouteIssuer({privateKey,principalKey,audience,readAuthority,now=()=>Date.now(),timeout=2500,maxPending=4,issuanceStore=null,scopedIssuance=false,contains=valeContains}){
  if(typeof contains!=="function")throw Error("Invalid region policy");
  if(privateKey?.type!=="private"||privateKey.asymmetricKeyType!=="ed25519"||
    !Buffer.isBuffer(principalKey)||principalKey.length<32||typeof audience!=="string"||!audience||audience.length>128||
    typeof readAuthority!=="function"||!Number.isInteger(timeout)||timeout<1||timeout>3000||
    !Number.isInteger(maxPending)||maxPending<1||maxPending>32||
    typeof scopedIssuance!=="boolean"||
    (issuanceStore!==null&&typeof issuanceStore.register!=="function")||
    (scopedIssuance&&(!issuanceStore||typeof issuanceStore.revokeScope!=="function")))throw Error("Invalid lab issuer configuration");
  const pseudonymKey=Buffer.from(principalKey);
  let pending=0,last=0;
  return async function issue(session,request,signal){
    if(!exact(request,["rideId","phase","origin","target"])||!isId(request.rideId)||typeof request.phase!=="string"||!Object.hasOwn(status,request.phase)||
      !point(request.origin,contains)||!point(request.target,contains))return {status:400};
    if(session==null)return {status:401};
    // Optional trusted caller lifetime, never a field from the JSON request.
    if(signal!==undefined&&!(signal instanceof AbortSignal))return {status:400};
    if(signal?.aborted)return {status:503};
    if(pending>=maxPending)return {status:429};
    const began=now();
    if(!Number.isSafeInteger(began)||began<last)return {status:503};
    last=began;
    // Snapshot only the allowed primitives before yielding to the adapter.
    const req={rideId:request.rideId,phase:request.phase,origin:{...request.origin},target:{...request.target}};
    const controller=new AbortController();
    let timer,finished=false,onAbort;
    pending++;
    const work=Promise.resolve().then(()=>readAuthority(session,{rideId:req.rideId,phase:req.phase},controller.signal));
    // A non-cooperative adapter continues occupying capacity until settled;
    // timeout never releases the slot early or permits late signing.
    work.then(()=>{if(!finished){finished=true;pending--;}},()=>{if(!finished){finished=true;pending--;}});
    try{
      const cancelled=new Promise(resolve=>{
        onAbort=()=>{controller.abort();resolve(null);};
        timer=setTimeout(onAbort,timeout);
        signal?.addEventListener("abort",onAbort,{once:true});
        if(signal?.aborted)onAbort();
      });
      const proof=await Promise.race([work,cancelled]);
      if(controller.signal.aborted||signal?.aborted)return {status:503};
      const t=now();
      if(!Number.isSafeInteger(t)||t>Number.MAX_SAFE_INTEGER-30000||t<last||t<began||t-began>timeout)return {status:503};
      last=t;
      const body=verifiedRouteProof(proof,req,t,contains);
      if(!body)return {status:403};
      const sub=createHmac("sha256",pseudonymKey).update(proof.driverId.toLowerCase()).digest("hex");
      const claim={aud:audience,iat:t,exp:t+30000,jti:randomBytes(18).toString("base64url"),sub,route:routeDigest(body)};
      const raw=Buffer.from(JSON.stringify(claim),"utf8");
      const token=raw.toString("base64url")+"."+sign(null,raw,privateKey).toString("base64url");
      // Persist only opaque issuance metadata before returning the credential.
      // A failed registration never returns a token or falls back to memory.
      if(issuanceStore){
        const metadata={jti:claim.jti,sub:claim.sub,exp:claim.exp};
        if(scopedIssuance)metadata.scope=routeLegScope(pseudonymKey,audience,req.rideId,req.phase);
        const registered=issuanceStore.register(metadata,t);
        if(registered?.status!==200)return {status:registered?.status===429?429:scopedIssuance&&registered?.status===403?403:503};
      }
      return {status:200,token};
    }catch{return {status:503};}
    finally{clearTimeout(timer);if(onAbort)signal?.removeEventListener("abort",onAbort);}
  };
}
