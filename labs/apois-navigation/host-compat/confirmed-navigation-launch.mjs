import {MotoristaAuthority} from "./motorista-authority.mjs";

// Laboratory entry-point policy. No backend mutation, route provider, GPS or
// native registration. The host supplies fresh authenticated evidence and the
// ORIGINAL external launch. Internal enablement must be explicit and separate
// from app/user settings; unverified points never leave this policy.
const statusFor = {PICKUP:"motorista_a_caminho",TRIP:"em_viagem"};
const uuid = v => typeof v==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export class ConfirmedNavigationLaunch {
  #epoch=0; #busy=null; #native=null; #blocked=false; #enabled; #checking=null;
  constructor({enabled=false,verify,openNative,closeNative,prepareAudio,cancelNativePreparation}) {
    this.#enabled=enabled===true;
    this.verify=verify;this.openNative=openNative;this.closeNative=closeNative;this.prepareAudio=prepareAudio;this.cancelNativePreparation=cancelNativePreparation;
  }
  // Session closure notifications originate only from the dedicated Capacitor
  // listener. Bind all fields, including revision. An unrelated replay event
  // must never clear a confirmed session or unlock an ambiguous launch.
  onNativeClosed(event) {
    if(event?.action!=="SESSION_CLOSED"||typeof event.sessionId!=="string")return false;
    const n=this.#native;
    if(n&&event.sessionId===n.id&&event.rideId===n.rideId&&event.revision===n.revision){
      this.#native=null;
      ++this.#epoch;
      n.releaseAudio?.();
      return true;
    }
    const t=this.#busy;
    // Android Back may arrive before openConfirmed resolves. Buffer a small
    // number of exact-reference closures; apply only to the returned session.
    if(t?.opening&&event.rideId===t.rideId&&event.revision===0&&t.closed.size<4){
      t.closed.add(event.sessionId);
      return true;
    }
    return false;
  }
  async recheck(){
    const n=this.#native;
    if(!n||this.#checking)return "idle";
    const ticket={};
    this.#checking=ticket;
    try{
      const p=await this.verify({rideId:n.rideId,phase:n.phase});
      if(this.#native!==n)return "stale";
      const authority=new MotoristaAuthority();
      const same=p&&["authUserId","driverId","profileUserId"].every(k=>p.identity?.[k]===n.identity[k]);
      if(!same||p.row?.id!==n.rideId||p.row.status!==statusFor[n.phase]||
        !authority.bind(p.identity)||!authority.accept(p.row,{epoch:authority.epoch,
          authUserId:n.identity.authUserId,driverId:n.identity.driverId,revision:0})){
        await this.invalidate();
        return "revoked";
      }
      return "current";
    }catch{
      if(this.#native!==n)return "stale";
      await this.invalidate();
      return "revoked"; // verification unavailable is not proof of assignment loss
    }finally{if(this.#checking===ticket)this.#checking=null;}
  }
  // UI state is a revocation hint only, never proof to authorize a launch.
  // Avoid racing a successful PIN/accept with React's previous render.
  observeRide(rideId,status){
    const n=this.#native;
    if(!n||n.rideId===rideId&&status===statusFor[n.phase])return;
    return this.recheck();
  }
  // Invalidate on logout, unmount, loss of assignment or new authoritative
  // phase. Never automatically launch a different navigator on revocation.
  async invalidate() {
    ++this.#epoch;
    const native=this.#native;
    const pending=this.#busy;
    this.#native=null;
    if(pending?.opening&&pending.request&&this.cancelNativePreparation){
      // Best-effort cancellation is NOT confirmation of no Activity. The
      // original open acknowledgement still controls cleanup/fallback.
      try {void Promise.resolve(this.cancelNativePreparation(pending.request)).catch(()=>{});}catch{}
    }
    if(native) {
      this.#blocked=true;
      try {
        if(await this.closeNative(native.id)===true){native.releaseAudio?.();this.#blocked=false;return true;}
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
    const ticket={epoch:this.#epoch,rideId,opening:false,closed:new Set()};
    this.#busy=ticket;
    const current=()=>this.#busy===ticket&&this.#epoch===ticket.epoch;
    let nativeUncertain=false;
    let releaseAudio=null;
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
      // A failed stop cannot grant native guidance or allow a second audio path.
      // The optional hook is installed only in the disposable generated host.
      if(this.prepareAudio){
        releaseAudio=await this.prepareAudio();
        if(typeof releaseAudio!=="function"){releaseAudio=null;return "unverified";}
        if(!current())return "stale";
      }
      nativeUncertain=true;
      ticket.request=request;
      ticket.opening=true;
      const result=await this.openNative(request,current);
      ticket.opening=false;
      if(!current()){
        if(result?.state==="unavailable"||result?.state==="opened"&&ticket.closed.has(result.sessionId)){nativeUncertain=false;}
        else if(result?.state==="opened"&&typeof result.sessionId==="string"&&result.sessionId.length>0){
          try { if(await this.closeNative(result.sessionId)===true)nativeUncertain=false; }catch{}
        }
        if(nativeUncertain)this.#blocked=true;
        return "stale";
      }
      if(result?.state==="opened"&&typeof result.sessionId==="string"&&result.sessionId.length>0){
        nativeUncertain=false;
        if(ticket.closed.has(result.sessionId))return "stale";
        this.#native=Object.freeze({id:result.sessionId,rideId,phase,revision:0,identity:Object.freeze({...proof.identity}),releaseAudio});
        releaseAudio=null; // native session owns the scope until confirmed closure
        return "internal";
      }
      // Only a definitive no-activity acknowledgement permits auto fallback.
      // Reject/timeout/malformed replies may mean native opened: fail silent,
      // keep original manual map controls available, do not open two activities.
      if(result?.state!=="unavailable"){this.#blocked=true;return "uncertain";}
      nativeUncertain=false;
      releaseAudio?.();releaseAudio=null;
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
    finally{
      // A possibly-open Activity retains the audio suppression. Do not silently
      // resume Web Speech on native timeout/rejection or ambiguous closure.
      if(!nativeUncertain)releaseAudio?.();
      if(this.#busy===ticket)this.#busy=null;
    }
  }
}
