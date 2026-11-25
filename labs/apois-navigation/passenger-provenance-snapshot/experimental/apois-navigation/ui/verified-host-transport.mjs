import {validCatalogPolicy,validateCatalog} from './catalog-validation.mjs'
// Host-side Supabase adapter; no URL/key defaults and no token persistence.
// The verified account is bound when the host opens, not read from request JSON.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const controls=new Set(['apois_navigation_catalog','apois_navigation_confirm','apois_navigation_active','apois_navigation_recover','apois_navigation_seal'])
const requests=new Set(['apois_navigation_quote','apois_navigation_create'])
export function createVerifiedHostTransport({auth,invoke,account,controlFunction,enabled=false}={}){
 if(enabled!==true)return null
 if(!uuid(account)||typeof auth?.getSession!=='function'||typeof auth?.getUser!=='function'||typeof invoke!=='function'||controlFunction!=='apois-navigation-control')throw Error('Invalid host transport')
 async function session(){
  const {data,error}=await auth.getSession()
  const s=data?.session
  if(error||s?.user?.id!==account||typeof s.access_token!=='string'||!s.access_token||s.access_token.length>8192)throw Error('Session changed')
  const verified=await auth.getUser(s.access_token)
  if(verified.error||verified.data?.user?.id!==account)throw Error('Session not verified')
  const again=await auth.getSession()
  if(again.error||again.data?.session?.user?.id!==account)throw Error('Session changed')
  return s.access_token
 }
 async function verifyIdentity(){try{await session();return account}catch{return null}}
 async function transport(body,signal){
  const target=controls.has(body?.action)?controlFunction:requests.has(body?.action)?'request-ride':null
  if(!target||signal?.aborted)throw Error('Invalid experimental action')
  const token=await session()
  if(signal?.aborted)throw Error('Cancelled')
  let timer
  try{
   // Timeout is not a cancellation acknowledgement. If a create request has
   // been sent, the durable journal remains unresolved until recovery/seal.
   const response=await Promise.race([invoke(target,{body,headers:{Authorization:'Bearer '+token}}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Request deadline')),12000)})])
   if(signal?.aborted||!await verifyIdentity())throw Error('Account changed')
   if(response?.error){
    const context=response.error.context
    if(!(context instanceof Response)||!Number.isInteger(context.status))throw Error('Transport unavailable')
    const value=await context.json()
    if(signal?.aborted||!await verifyIdentity())throw Error('Account changed')
    return {status:context.status,body:value}
   }
   if(!response?.data||typeof response.data!=='object')throw Error('Invalid response')
   return {status:200,body:response.data}
  }finally{clearTimeout(timer)}
 }
 async function confirm(payload,signal){
  if(payload?.confirmed!==true)return null
  const result=await transport({action:'apois_navigation_confirm',requestKey:payload.requestKey,pickup:payload.pickup,destination:payload.destination},signal)
  if(result.status!==200||result.body?.ok!==true)return null
  const {ok,...confirmed}=result.body
  return confirmed
 }
 async function activeRide(scope){
  if(scope!==account)return {verified:false}
  const result=await transport({action:'apois_navigation_active'},AbortSignal.timeout(10000))
  return result.status===200&&result.body?.verified===true?result.body:{verified:false}
 }
 async function readCatalog(policy,signal){
  if(!validCatalogPolicy(policy)||signal?.aborted)return null
  try{
   const response=await transport({action:'apois_navigation_catalog'},signal)
   if(response.status!==200||response.body?.ok!==true||signal?.aborted)return null
   return validateCatalog(response.body.catalog,policy)
  }catch{return null}
 }
 return {verifyIdentity,transport,confirm,activeRide,readCatalog,verifiedAuthorization:async()=>({Authorization:'Bearer '+await session()})}
}
