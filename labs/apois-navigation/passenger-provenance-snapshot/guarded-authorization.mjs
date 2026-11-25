// Experimental ordering barrier. Only a trusted fixture transaction may
// supply withBarrier; it must hold the PostgreSQL lock until SQLite admission
// completes and acknowledge COMMIT before returning. No production adapter.
import {createRouteAuthorization} from '../valhalla/route-authorization.mjs'
import {createRevocationReconciler} from './revocation-reconciler.mjs'
export function createGuardedAuthorization({publicKey,audience,principalKey,store,withBarrier,now=()=>Date.now()}) {
  if(typeof withBarrier!=='function'||typeof store?.admit!=='function') throw Error('Missing admission barrier')
  const preflight=createRouteAuthorization({publicKey,audience,now,store:{admit:()=>({status:200})}})
  const admit=createRouteAuthorization({publicKey,audience,now,store})
  return async (header,body,signal)=>{
    if(!(signal instanceof AbortSignal)||signal.aborted) return {status:503}
    const check=preflight(header,body)
    if(check.status!==200)return check
    let grant=null,entered=false,closed=false
    const abort=()=>{closed=true;grant?.release?.()}
    signal.addEventListener('abort',abort,{once:true})
    try{
      const result=await withBarrier(signal,async readSnapshot=>{
        if(entered||closed||signal.aborted)return {status:503}
        entered=true
        const reconcile=createRevocationReconciler({readSnapshot,store,principalKey,audience,now})
        if((await reconcile(signal)).status!==200||closed||signal.aborted)return {status:503}
        grant=admit(header,body)
        return grant
      })
      if(!grant||result!==grant||closed||signal.aborted){grant?.release?.();return {status:503}}
      return grant
    }catch{grant?.release?.();return {status:503}}
    finally{closed=true;signal.removeEventListener('abort',abort)}
  }
}
