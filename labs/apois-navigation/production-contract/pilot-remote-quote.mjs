import {createRemoteQuoteMetrics} from '../remote-quote/remote-quote-metrics.mjs'
export function pilotAllowed(id,raw){
 return typeof id==='string'&&typeof raw==='string'&&raw.split(',').some(v=>v.trim().toLowerCase()===id.toLowerCase()&&v.trim()!=='')
}
// Configuration is evaluated lazily: reuse of a committed ride needs no router.
export function pilotRemoteQuoteMetrics({authUserId,readEnv,fetcher=fetch}){
 return async(origin,destination)=>{
  try{
   const metrics=await createRemoteQuoteMetrics({
    endpoint:readEnv('APOIS_NAVIGATION_QUOTE_ENDPOINT'),
    keyId:readEnv('APOIS_NAVIGATION_QUOTE_KEY_ID'),
    secret:readEnv('APOIS_NAVIGATION_QUOTE_SECRET'),
    authUserId,fetcher
   })
   return await metrics(origin,destination)
  }catch{return null}
 }
}
