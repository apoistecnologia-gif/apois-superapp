// Separate recovery-only endpoint candidate. Can remain available after new
// experimental creation is disabled. No route, fare, dispatch, wallet or cancel.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const result=(status,body)=>({status,body})
const fail=(status,error_code)=>result(status,{ok:false,error_code})
export function createRecoveryAction({enabled=false,verifySession,rpc}={}){
 if(enabled!==true)return async()=>fail(409,'experimental_recovery_unavailable')
 if(typeof verifySession!=='function'||typeof rpc!=='function')throw Error('Missing recovery authority')
 return async(session,body)=>{
  if(!body||typeof body!=='object'||Array.isArray(body))return fail(422,'invalid_recovery_request')
  const action=body.action,active=action==='apois_navigation_active'
  if(![ 'apois_navigation_active','apois_navigation_recover','apois_navigation_seal'].includes(action))return fail(422,'invalid_recovery_request')
  const keys=active?['action']:['action','selectionId','requestKey']
  if(Object.keys(body).length!==keys.length||Object.keys(body).some(k=>!keys.includes(k))||(!active&&(!uuid(body.selectionId)||!uuid(body.requestKey))))return fail(422,'invalid_recovery_request')
  try{
   const auth=await verifySession(session)
   if(!uuid(auth))return fail(401,'unauthorized')
   if(active){
    const value=await rpc('apois_nav_lab_active_v21',{p_auth_user:auth})
    return value?.verified===true&&Object.hasOwn(value,'ride')?result(200,value):fail(409,'active_ride_unverified')
   }
   const value=await rpc('apois_nav_lab_reconcile_v21',{p_auth_user:auth,p_selection:body.selectionId,p_request_key:body.requestKey,p_seal:action==='apois_navigation_seal'})
   if(!value||value.selectionId!==body.selectionId||value.requestKey!==body.requestKey||!['open','sealed','ride'].includes(value.state))return fail(409,'recovery_unverified')
   return result(200,{ok:true,...value})
  }catch{return fail(503,'recovery_unavailable')}
 }
}
