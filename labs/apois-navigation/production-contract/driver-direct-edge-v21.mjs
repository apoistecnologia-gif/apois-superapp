// Candidate native local-mode transport: verified target only, no broker,
// issuer, route geometry, GPS upload, or business mutation.
import {uuid,boundedJson,json,deny} from '../driver-broker/http.mjs'
import {bearerToken} from './edge-session-v21.mjs'
import {trustedTarget} from './driver-control-v21.mjs'
/**
 * @param {{enabled?:boolean,verifySession?:(token:string,signal:AbortSignal)=>Promise<string|null>,allowPilot?:(id:string)=>boolean|Promise<boolean>,readLimited?:(input:{authUserId:string,rideId:string,phase:string},signal:AbortSignal)=>Promise<unknown>,now?:()=>number,timeoutMs?:number,maxPending?:number}} [options]
 * @returns {(request:Request)=>Promise<Response>}
 */
export function createDirectLocalDriverEdge({enabled=false,verifySession,allowPilot,readLimited,now=Date.now,timeoutMs=5000,maxPending=4}={}){
 if(!enabled)return async()=>deny(409)
 if(![verifySession,allowPilot,readLimited,now].every(f=>typeof f==='function')||!Number.isSafeInteger(timeoutMs)||timeoutMs<50||timeoutMs>5000||!Number.isInteger(maxPending)||maxPending<1||maxPending>32)throw Error('Missing trusted target dependencies')
 let pending=0
 return async req=>{
  if(req.method!=='POST')return deny(405)
  const token=bearerToken(req.headers.get('authorization'))
  if(!token)return deny(401)
  if(req.signal.aborted)return deny(503)
  if(pending>=maxPending)return deny(429)
  const ctrl=new AbortController(),signal=AbortSignal.any([req.signal,ctrl.signal])
  let timer,onAbort
  pending++
  const work=(async()=>{
   try{
    const request=await boundedJson(req)
    if(request?.action!=='target')return deny(409)
    if(Object.keys(request).length!==3||!uuid(request.rideId)||!['PICKUP','TRIP'].includes(request.phase))return deny(422)
    if(signal.aborted)return deny(503)
    const actor=await verifySession(token,signal)
    if(!uuid(actor))return deny(401)
    if(await allowPilot(actor)!==true)return deny(403)
    if(signal.aborted)return deny(503)
    const value=await readLimited({authUserId:actor,rideId:request.rideId,phase:request.phase},signal)
    if(signal.aborted)return deny(503)
    if(!value||typeof value!=='object'||Object.keys(value).length!==2||typeof value.limited!=='boolean'||!Object.hasOwn(value,'proof'))return deny(503)
    if(value.limited)return deny(429)
    if(await verifySession(token,signal)!==actor)return deny(401)
    if(signal.aborted)return deny(503)
    if(await allowPilot(actor)!==true)return deny(403)
    const target=trustedTarget(value.proof,request.rideId,request.phase,now())
    if(!target||target.identity.authUserId!==actor)return deny(403)
    return json(200,{ok:true,target})
   }catch{return deny(503)}
  })()
  work.then(()=>pending--,()=>pending--)
  try{
   const deadline=new Promise(resolve=>{
    onAbort=()=>{ctrl.abort();resolve(deny(503))}
    timer=setTimeout(onAbort,timeoutMs)
    req.signal.addEventListener('abort',onAbort,{once:true});if(req.signal.aborted)onAbort()
   })
   return await Promise.race([work,deadline])
  }finally{clearTimeout(timer);if(onAbort)req.signal.removeEventListener('abort',onAbort)}
 }
}
