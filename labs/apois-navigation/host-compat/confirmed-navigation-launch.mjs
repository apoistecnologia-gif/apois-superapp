import {MotoristaAuthority} from "./motorista-authority.mjs";

// Laboratory entry-point policy. No backend mutation, route provider, GPS or
// native registration. The host supplies fresh authenticated evidence and the
// ORIGINAL external launch. Internal enablement must be explicit and separate
// from app/user settings; unverified points never leave this policy.
const statusFor = {PICKUP:"motorista_a_caminho",TRIP:"em_viagem"};
const uuid = v => typeof v==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export class ConfirmedNavigationLaunch {
  #epoch=0; #busy=null; #native=null; #blocked=false; #enabled;
  constructor({enabled=false,verify,openNative,closeNative}) {
    this.#enabled=enabled===true;
    this.verify=verify;this.openNative=openNative;this.closeNative=closeNative;
  }
  // Invalidate on logout, unmount, loss of assignment or new authoritative
  // phase. Never automatically launch a different navigator on revocation.
  async invalidate() {
    ++this.#epoch;
    const native=this.#native;
    this.#native=null;
    if(native) {
      this.#blocked=true;
      try {
        if(await this.closeNative(native)===true){this.#blocked=false;return true;}
      } catch {}
      return false;
    }
    return !this.#blocked && !this.#busy;
  }
  async launch({rideId,phase,openExternal}) {
    // Preserve exact QA290 behavior by default: no verification RPC, native
    // calls, state changes, or new dependency on an experimental feature.
    if(!this.#enabled){await openExternal();return "external";}
    if(!uuid(rideId)||!Object.hasOwn(statusFor,phase))return "unverified";
    if(this.#busy||this.#native)return "busy";
    if(this.#blocked)return "uncertain";
    const ticket={epoch:this.#epoch};
    this.#busy=ticket;
    const current=()=>this.#busy===ticket&&this.#epoch===ticket.epoch;
    let nativeUncertain=false;
    try {
      const proof=await this.verify({rideId,phase});
      if(!current())return "stale";
      if(!proof||proof.row?.id!==rideId||proof.row.status!==statusFor[phase])return "unverified";
      const authority=new MotoristaAuthority();
      if(!authority.bind(proof.identity)||!authority.accept(proof.row,{
        epoch:authority.epoch,authUserId:proof.identity.authUserId,
        driverId:proof.identity.driverId,revision:0
      })||authority.snapshot?.phase!==phase)return "unverified";
      // Pass only a host-approved immutable reference. PIN, pricing, Google
      // geocoding/polyline, account IDs and tokens are never bridge arguments.
      // A future adapter must independently prove target provenance before routing.
      const request=Object.freeze({rideId,phase,revision:0});
      nativeUncertain=true;
      const result=await this.openNative(request);
      if(!current()){
        if(result?.state==="unavailable"){nativeUncertain=false;}
        else if(result?.state==="opened"&&typeof result.sessionId==="string"&&result.sessionId.length>0){
          try { if(await this.closeNative(result.sessionId)===true)nativeUncertain=false; }catch{}
        }
        if(nativeUncertain)this.#blocked=true;
        return "stale";
      }
      if(result?.state==="opened"&&typeof result.sessionId==="string"&&result.sessionId.length>0){
        nativeUncertain=false;
        this.#native=result.sessionId;
        return "internal";
      }
      // Only a definitive no-activity acknowledgement permits auto fallback.
      // Reject/timeout/malformed replies may mean native opened: fail silent,
      // keep original manual map controls available, do not open two activities.
      if(result?.state!=="unavailable"){this.#blocked=true;return "uncertain";}
      nativeUncertain=false;
      // Reverify even after a definitive failure: account/ride may have changed
      // while the native attempt was running.
      const again=await this.verify({rideId,phase});
      if(!current())return "stale";
      if(!again||again.row?.id!==rideId||again.row.status!==statusFor[phase]||
         again.identity?.authUserId!==proof.identity.authUserId||
         again.identity?.driverId!==proof.identity.driverId||
         again.identity?.profileUserId!==proof.identity.profileUserId||
         !authority.accept(again.row,{epoch:authority.epoch,
           authUserId:proof.identity.authUserId,driverId:proof.identity.driverId,revision:1}))
        return "unverified";
      await openExternal();
      return current()?"external":"stale";
    }catch{
      if(nativeUncertain)this.#blocked=true;
      return current()?(nativeUncertain?"uncertain":"unverified"):"stale";
    }
    finally{if(this.#busy===ticket)this.#busy=null;}
  }
}
