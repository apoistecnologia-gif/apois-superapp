// Candidate-only bridge to the exact-token/session verifier. No production RPC
// is installed by this file. The policy must be explicitly reviewed.
import {createLocalDriverSessionVerifier} from '../driver-broker/driver-local-session.mjs'
export function bearerToken(header){
 if(typeof header!=='string'||header.length>8192||!/^Bearer [-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(header))return null
 return header.slice(7)
}
export function createV21EdgeSession({projectUrl,sessionPolicyConfirmed=false,authClient,serviceClient,now=Date.now,timeoutMs=1800,maxPending=4}={}){
 if(typeof authClient?.auth?.getUser!=='function'||typeof serviceClient?.rpc!=='function')throw Error('Missing session clients')
 return createLocalDriverSessionVerifier({projectUrl,sessionPolicyConfirmed,now,timeoutMs,maxPending,
  getUser:async token=>{
   const {data,error}=await authClient.auth.getUser(token)
   return error?null:data?.user??null
  },
  sessionExists:async({authUserId,sessionId},signal)=>{
   const {data,error}=await serviceClient.rpc('apois_nav_lab_session_exists_v21',{p_auth_user:authUserId,p_session:sessionId}).abortSignal(signal)
   if(error)throw Error('Private session proof unavailable')
   return data===true
  }
 })
}
