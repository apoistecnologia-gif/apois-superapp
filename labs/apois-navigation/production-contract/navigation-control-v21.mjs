import {createRecoveryAction} from './recovery-v21.mjs'
import {validCatalogPolicy,validateCatalog} from './catalog-validation.mjs'
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const exact=(o,k)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===k.length&&k.every(x=>Object.hasOwn(o,x))
const point=p=>exact(p,['id','version'])&&uuid(p.id)&&Number.isSafeInteger(p.version)&&p.version>0&&p.version<=2147483647
const fail=(status,error_code)=>({status,body:{ok:false,error_code}})
export function createNavigationControl({confirmationEnabled=false,recoveryEnabled=false,verifySession,rpc,allowPilot=()=>false,catalogPolicy}={}){
 const recovery=createRecoveryAction({enabled:recoveryEnabled,verifySession,rpc})
 if(confirmationEnabled===true&&![verifySession,rpc,allowPilot].every(f=>typeof f==='function'))throw Error('Missing trusted confirmation dependency')
 return async(session,body)=>{
  const catalog=body?.action==='apois_navigation_catalog'
  if(!catalog&&body?.action!=='apois_navigation_confirm')return recovery(session,body)
  if(confirmationEnabled!==true)return fail(409,'experimental_navigation_disabled')
  if(!validCatalogPolicy(catalogPolicy))return fail(503,'catalog_not_configured')
  if(catalog&&!exact(body,['action']))return fail(422,'invalid_catalog_request')
  if(!catalog&&(!exact(body,['action','requestKey','pickup','destination'])||!uuid(body.requestKey)||!point(body.pickup)||!point(body.destination)||body.pickup.id===body.destination.id||body.pickup.version!==catalogPolicy.version||body.destination.version!==catalogPolicy.version))return fail(422,'invalid_confirmation')
  try{
   const user=await verifySession(session)
   if(!uuid(user))return fail(401,'unauthorized')
   if(await allowPilot(user)!==true)return fail(403,'pilot_not_authorized')
   const policy={p_auth_user:user,p_version:catalogPolicy.version,p_extract:catalogPolicy.extractHash}
   if(catalog){
    const value=validateCatalog(await rpc('apois_nav_lab_catalog_v21',policy),catalogPolicy)
    return value?{status:200,body:{ok:true,catalog:value}}:fail(409,'catalog_unavailable')
   }
   const value=await rpc('apois_nav_lab_confirm_catalog_v21',{...policy,p_request_key:body.requestKey,p_pickup:body.pickup.id,p_destination:body.destination.id})
   if(!uuid(value?.selectionId)||value.requestKey!==body.requestKey||!value.origin||!value.destination||!Number.isFinite(Date.parse(value.expiresAt)))return fail(409,'selection_unavailable')
   return {status:200,body:{ok:true,...value}}
  }catch{return fail(503,'confirmation_unavailable')}
 }
}
