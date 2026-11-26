// Web-standard server-side verifier; no secrets, endpoints or network at import.
// JWT claims are untrusted until getUser verifies the original bearer token.
import {uuid} from './http.mjs'
const unavailable=()=>Error('Session verification unavailable')
function claims(token,issuer,seconds){
 if(typeof token!=='string'||token.length>8192||!/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(token))return null
 try{
  const raw=token.split('.')[1],base64=raw.replaceAll('-','+').replaceAll('_','/')
  const decoded=atob(base64+'='.repeat((4-base64.length%4)%4))
  if(btoa(decoded).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')!==raw)return null
  const c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(decoded,x=>x.charCodeAt(0))))
  if(c?.iss!==issuer||c.aud!=='authenticated'||c.role!=='authenticated'||c.is_anonymous===true||
     !uuid(c.sub)||!uuid(c.session_id)||!Number.isSafeInteger(c.exp)||!Number.isSafeInteger(c.iat)||
     c.iat>seconds||c.exp<=seconds||c.exp<=c.iat)return null
  return {authUserId:c.sub,sessionId:c.session_id,exp:c.exp}
 }catch{return null}
}
export function createLocalDriverSessionVerifier({projectUrl,sessionPolicyConfirmed=false,getUser,sessionExists,now=Date.now,timeoutMs=1800,maxPending=4}={}){
 // Confirmation means project policy has been reviewed and supported by
 // the configured session reader. A missing/unknown policy never enables.
 if(sessionPolicyConfirmed!==true||typeof projectUrl!=='string'||!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(projectUrl)||
    ![getUser,sessionExists,now].every(f=>typeof f==='function')||
    !Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>2500||!Number.isInteger(maxPending)||maxPending<1||maxPending>32)throw Error('Invalid local session policy')
 const issuer=new URL('/auth/v1',projectUrl).href
 let pending=0
 return async(token,signal)=>{
  if(!(signal instanceof AbortSignal)||signal.aborted)return null
  const began=Math.floor(now()/1000)
  if(!Number.isSafeInteger(began))throw unavailable()
  const p=claims(token,issuer,began);if(!p)return null
  if(pending>=maxPending)throw unavailable()
  const controller=new AbortController(),combined=AbortSignal.any([signal,controller.signal])
  const work=(async()=>{
   const user=await getUser(token,combined)
   if(combined.aborted)throw unavailable()
   if(!user||user.id!==p.authUserId||user.is_anonymous===true)return null
   const active=await sessionExists(Object.freeze({authUserId:p.authUserId,sessionId:p.sessionId}),combined)
   if(combined.aborted)throw unavailable()
   if(active!==true)return null
   const end=Math.floor(now()/1000)
   return Number.isSafeInteger(end)&&end>=began&&end<p.exp?p.authUserId:null
  })()
  pending++;work.then(()=>pending--,()=>pending--)
  let timer,onAbort
  try{
   const stop=new Promise((_,reject)=>{
    onAbort=()=>{controller.abort();reject(unavailable())}
    timer=setTimeout(onAbort,timeoutMs)
    signal.addEventListener('abort',onAbort,{once:true});if(signal.aborted)onAbort()
   })
   return await Promise.race([work,stop])
  }catch{throw unavailable()}
  finally{clearTimeout(timer);if(onAbort)signal.removeEventListener('abort',onAbort)}
 }
}
