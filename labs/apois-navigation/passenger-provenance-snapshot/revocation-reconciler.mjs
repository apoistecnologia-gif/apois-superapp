// Private lab reconciliation. A complete bounded snapshot is required each
// time, so there is no volatile cursor that could skip a committed event.
// A real gateway must gate all admissions/issuance and handle the remaining
// cross-database race. This is not a public API or background worker.
import {routeLegScope} from "../valhalla/route-issuer.mjs";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const valid=e=>e&&typeof e==="object"&&!Array.isArray(e)&&Object.keys(e).length===2&&
  typeof e.rideId==="string"&&uuid.test(e.rideId)&&["PICKUP","TRIP"].includes(e.phase);
export function createRevocationReconciler({readSnapshot,store,principalKey,audience,now=()=>Date.now(),maxRows=4096}={}){
  if(typeof readSnapshot!=="function"||typeof store?.revokeScope!=="function"||!Buffer.isBuffer(principalKey)||principalKey.length<32||
      typeof audience!=="string"||!audience||audience.length>128||!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>4096)throw Error("Invalid reconciliation configuration");
  const key=Buffer.from(principalKey);
  let pending=false;
  return async function reconcile(signal){
    if(!(signal instanceof AbortSignal)||signal.aborted||pending)return {status:503};
    pending=true;
    try{
      // readSnapshot must read ALL tombstones or return overflow; never
      // report a truncated list as complete. Query maxRows+1.
      const rows=await readSnapshot(maxRows+1,signal);
      if(signal.aborted||!Array.isArray(rows)||rows.length>maxRows||!rows.every(valid))return {status:503};
      for(const row of rows){
        if(signal.aborted)return {status:503};
        if(store.revokeScope(routeLegScope(key,audience,row.rideId,row.phase),now())?.status!==200)return {status:503};
      }
      return {status:200};
    }catch{return {status:503};}
    finally{pending=false;}
  };
}
