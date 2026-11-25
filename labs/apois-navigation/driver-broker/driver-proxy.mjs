// Login JWT is used only by verifySession; never forwarded.
import {createDriverSigner} from './driver-protocol.mjs'
import {uuid,boundedJson,json,deny} from './http.mjs'
export function createDriverProxy({enabled=false,endpoint,keyId,secret,verifySession,allowPilot,fetcher=fetch}={}){
 if(!enabled)return async()=>deny(409)
 const url=new URL(endpoint)
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/driver-control'||url.search||url.hash||typeof verifySession!=='function'||typeof allowPilot!=='function')throw Error('Invalid trusted proxy configuration')
 return async req=>{
  if(req.method!=='POST')return deny(405)
  const header=req.headers.get('authorization')??''
  if(!header.startsWith('Bearer ')||header.length>8192)return deny(401)
  try{
   const request=await boundedJson(req)
   const actor=await verifySession(header.slice(7))
   if(!uuid(actor))return deny(401)
   if(await allowPilot(actor)!==true)return deny(403)
   if(req.signal.aborted)return deny(503)
   const body={authUserId:actor,request},serialized=JSON.stringify(body)
   if(new TextEncoder().encode(serialized).length>2048)return deny(413)
   const signer=await createDriverSigner({keyId,secret,authUserId:actor})
   const response=await fetcher(url,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:await signer(body)},body:serialized,signal:AbortSignal.any([req.signal,AbortSignal.timeout(6000)])})
   const result=await boundedJson(response,16384)
   return json([200,400,401,403,404,409,422,429,503].includes(response.status)?response.status:503,result)
  }catch{return deny(503)}
 }
}
