// Lab server-side issuer. No HTTP listener, production credentials, database,
// or default identity adapter. The injected authority MUST authenticate and
// load independent, server-owned evidence, not echo client-supplied fields.
import {createHmac,randomBytes,sign} from "node:crypto";
import {normalizeRoute} from "./route-gateway.mjs";
import {routeDigest} from "./route-authorization.mjs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isId=v=>typeof v==="string"&&uuid.test(v);
const exact=(o,keys)=>o!==null&&typeof o==="object"&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const point=p=>exact(p,["lat","lon"])&&typeof p.lat==="number"&&typeof p.lon==="number"&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=-9.65&&p.lat<=-9.10&&p.lon>=-40.80&&p.lon<=-40.20;
const status={PICKUP:"motorista_a_caminho",TRIP:"em_viagem"};
export function routeBody(origin,target){
  if(!point(origin)||!point(target))return null;
  return normalizeRoute({locations:[{...origin,type:"break"},{...target,type:"break"}],costing:"auto",units:"kilometers",language:"pt-BR",format:"osrm",voice_instructions:true,banner_instructions:true,shape_format:"polyline6"});
}
export function verifiedRouteProof(proof,request,now){
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
    !["INDEPENDENT_GPS","INDEPENDENT_OSM"].includes(evidence.source)||!point(evidence.point))return null;
  if(!point(request.target)||request.target.lat!==evidence.point.lat||request.target.lon!==evidence.point.lon)return null;
  return routeBody(request.origin,evidence.point);
}
export function createRouteIssuer({privateKey,principalKey,audience,readAuthority,now=()=>Date.now(),timeout=2500,maxPending=4}){
  if(privateKey?.type!=="private"||privateKey.asymmetricKeyType!=="ed25519"||
    !Buffer.isBuffer(principalKey)||principalKey.length<32||typeof audience!=="string"||!audience||audience.length>128||
    typeof readAuthority!=="function"||!Number.isInteger(timeout)||timeout<1||timeout>3000||
    !Number.isInteger(maxPending)||maxPending<1||maxPending>32)throw Error("Invalid lab issuer configuration");
  const pseudonymKey=Buffer.from(principalKey);
  let pending=0,last=0;
  return async function issue(session,request){
    if(!exact(request,["rideId","phase","origin","target"])||!isId(request.rideId)||typeof request.phase!=="string"||!Object.hasOwn(status,request.phase)||
      !point(request.origin)||!point(request.target))return {status:400};
    if(session==null)return {status:401};
    if(pending>=maxPending)return {status:429};
    const began=now();
    if(!Number.isSafeInteger(began)||began<last)return {status:503};
    last=began;
    // Snapshot only the allowed primitives before yielding to the adapter.
    const req={rideId:request.rideId,phase:request.phase,origin:{...request.origin},target:{...request.target}};
    const controller=new AbortController();
    let timer,finished=false;
    pending++;
    const work=Promise.resolve().then(()=>readAuthority(session,{rideId:req.rideId,phase:req.phase},controller.signal));
    // A non-cooperative adapter continues occupying capacity until settled;
    // timeout never releases the slot early or permits late signing.
    work.then(()=>{if(!finished){finished=true;pending--;}},()=>{if(!finished){finished=true;pending--;}});
    try{
      const proof=await Promise.race([work,new Promise(resolve=>{timer=setTimeout(()=>{controller.abort();resolve(null);},timeout);})]);
      if(controller.signal.aborted)return {status:503};
      const t=now();
      if(!Number.isSafeInteger(t)||t>Number.MAX_SAFE_INTEGER-30000||t<last||t<began||t-began>timeout)return {status:503};
      last=t;
      const body=verifiedRouteProof(proof,req,t);
      if(!body)return {status:403};
      const sub=createHmac("sha256",pseudonymKey).update(proof.driverId.toLowerCase()).digest("hex");
      const claim={aud:audience,iat:t,exp:t+30000,jti:randomBytes(18).toString("base64url"),sub,route:routeDigest(body)};
      const raw=Buffer.from(JSON.stringify(claim),"utf8");
      return {status:200,token:raw.toString("base64url")+"."+sign(null,raw,privateKey).toString("base64url")};
    }catch{return {status:503};}
    finally{clearTimeout(timer);}
  };
}
