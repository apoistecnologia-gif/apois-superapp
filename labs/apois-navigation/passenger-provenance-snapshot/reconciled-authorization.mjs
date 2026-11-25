// Lab gate. Signature/route preflight must precede expensive DB reads.
// Reconcile every valid request, then repeat signature/time validation and
// atomic SQLite admission. A remote commit can still race the local admission.
import {createRouteAuthorization} from "../valhalla/route-authorization.mjs";
export function createReconciledAuthorization({publicKey,audience,store,reconcile,now=()=>Date.now()}={}){
  if(typeof store?.admit!=="function"||typeof reconcile!=="function")throw Error("Strict store and reconciliation required");
  const preflight=createRouteAuthorization({publicKey,audience,now,store:{admit:()=>({status:200})}});
  const admit=createRouteAuthorization({publicKey,audience,now,store});
  return async(header,body,signal)=>{
    if(!(signal instanceof AbortSignal)||signal.aborted)return {status:503};
    const check=preflight(header,body);
    if(check.status!==200)return check;
    try{
      const sync=await reconcile(signal);
      if(signal.aborted||sync?.status!==200)return {status:503};
      return admit(header,body);
    }catch{return {status:503};}
  };
}
