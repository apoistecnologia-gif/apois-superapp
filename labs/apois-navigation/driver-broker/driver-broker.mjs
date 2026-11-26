// Private handler, not a deployed service. Dependencies must be trusted.
import {createDriverVerifier} from './driver-protocol.mjs'
import {createDriverControl} from '../production-contract/driver-control-v21.mjs'
import {createDriverAuthority} from '../passenger-provenance-snapshot/driver-authority.mjs'
import {createRouteIssuer} from '../valhalla/route-issuer.mjs'
import {boundedJson,json,deny} from './http.mjs'
export async function createDriverBroker({enabled=false,localOnly=false,keys,admissionStore,issuanceStore,allowPilot,readDriverProof,privateKey,principalKey,audience}={}){
 if(!enabled)return async()=>deny(409)
 if(typeof localOnly!=='boolean'||typeof admissionStore?.admit!=='function'||typeof allowPilot!=='function'||typeof readDriverProof!=='function')throw Error('Trusted stores and authority required')
 if(localOnly){if([issuanceStore,privateKey,principalKey,audience].some(v=>v!==undefined))throw Error('Local mode cannot configure a remote issuer')}
 else if(typeof issuanceStore?.register!=='function'||typeof issuanceStore?.revokeScope!=='function'||admissionStore===issuanceStore)throw Error('Trusted issuance store required')
 const verify=await createDriverVerifier({keys,admit:(c,t)=>admissionStore.admit(c,t)})
 const authority=createDriverAuthority({verifySession:async actor=>await allowPilot(actor)===true?actor:null,readDriverProof})
 const issuePermit=localOnly?undefined:createRouteIssuer({privateKey,principalKey,audience,readAuthority:authority,issuanceStore,scopedIssuance:true})
 const control=createDriverControl({enabled:true,localOnly,authority,issuePermit,allowPilot})
 return async req=>{
  if(req.method!=='POST'||new URL(req.url).pathname!=='/driver-control'||new URL(req.url).search)return deny(404)
  let lease
  try{
   const body=await boundedJson(req)
   lease=await verify(req.headers.get('authorization'),body,req.signal)
   if(lease.status!==200)return deny(lease.status)
   const result=await control(body.authUserId,body.request,req.signal)
   return json(result.status,result.body)
  }catch{return deny(503)}finally{lease?.release?.()}
 }
}
