import {MotoristaAuthority} from "./motorista-authority.mjs";

// Laboratory entry-point policy. No backend mutation, route provider, GPS or
// native registration. The host supplies fresh authenticated evidence and the
// ORIGINAL external launch. Internal enablement must be explicit and separate
// from app/user settings; unverified points never leave this policy.
const statusFor = {PICKUP:"motorista_a_caminho",TRIP:"em_viagem"};
const uuid = v => typeof v==="string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export class ConfirmedNavigationLaunch {
  #epoch=0; #busy=null; #native=null; #blocked=false; #enabled; #checking=null; #closing=null; #external=null;
  constructor({enabled=false,verify,openNative,closeNative,prepareAudio,cancelNativePreparation,canOpenNative}) {
    this.#enabled=enabled===true;
    this.verify=verify;this.openNative=openNative;this.closeNative=closeNative;this.prepareAudio=prepareAudio;this.cancelNativePreparation=cancelNativePreparation;this.canOpenNative=canOpenNative;
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
    const closing=this.#closing;
    if(closing&&event.sessionId===closing.id&&event.rideId===closing.rideId&&event.revision===closing.revision){
      this.#finishClose(closing);
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
  #finishClose(closing){
    if(this.#closing!==closing)return false;
    this.#closing=null;
    closing.releaseAudio?.();
    this.#blocked=false;
    return true;
  }
  // Keep the exact closing reference after a timeout. A late destruction
  // event or an idempotent native acknowledgement may safely unblock it.
  async #awaitClose(closing){
    if(closing.pending)return closing.pending;
    const attempt=(async()=>{
      try {
        if(await this.closeNative(closing.id)===true){
          this.#finishClose(closing);
          return true;
        }
      } catch {}
      return this.#closing!==closing;
    })();
    closing.pending=attempt;
    try{return await attempt;}
    finally{if(closing.pending===attempt)closing.pending=null;}
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
      if(!same||p.row?.id!==n.rideId||p.row.status!==statusFor[n.phase]||p.row.category!=="carros"||
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
      if(!pending.cancel){
        try {pending.cancel=Promise.resolve(this.cancelNativePreparation(pending.request)).catch(()=>false);}catch{}
      }
    }
    if(native) {
      this.#blocked=true;
      this.#closing={...native,pending:null};
      return this.#awaitClose(this.#closing);
    }
    if(this.#closing)return this.#awaitClose(this.#closing);
    return !this.#blocked && !this.#busy && !this.#external;
  }
  // Explicit Google/Waze actions share the same in-process opening gate.
  // An ambiguous native open/close must never be treated as permission to
  // start a second navigator. Default mode calls the original action directly.
  canDetachListener(){return !this.#busy&&!this.#native&&!this.#closing&&!this.#blocked;}
  async runExternal(work){
    if(typeof work!=="function")throw Error("Invalid external navigation callback");
    if(!this.#enabled)return work();
    if(this.#busy||this.#native||this.#blocked||this.#closing||this.#external)
      throw Error("Encerre a navegação anterior antes de abrir outro mapa.");
    const ticket={};this.#external=ticket;
    try{return await work();}
    finally{if(this.#external===ticket)this.#external=null;}
  }
  async launch({rideId,phase,openExternal,allowExternalFallback=true}) {
    // Preserve exact QA290 behavior by default: no verification RPC, native
    // calls, state changes, or new dependency on an experimental feature.
    if(!this.#enabled){if(!allowExternalFallback)return "unavailable";await openExternal();return "external";}
    if(!uuid(rideId)||!Object.hasOwn(statusFor,phase))return "unverified";
    if(this.#busy||this.#native||this.#external)return "busy";
    if(this.#blocked)return "uncertain";
    const ticket={epoch:this.#epoch,rideId,opening:false,closed:new Set(),cancel:null};
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
      // The existing external route remains available for all categories.
      // Only a verified passenger-car ride may use the auto-costing resolver.
      if(proof.row.category!=="carros"){
        if(!allowExternalFallback)return "unavailable";
        await openExternal();
        return current()?"external":"stale";
      }
      // No TTS handoff or extra native opening when the native host is not
      // configured. A capability error is safe here: no opening was attempted.
      if(this.canOpenNative){
        let available=false;
        try{available=await this.canOpenNative()===true;}catch{}
        if(!current())return "stale";
        if(!available){
          if(!allowExternalFallback)return "unavailable";
          const again=await this.verify({rideId,phase});
          if(!current())return "stale";
          if(!again||again.row?.id!==rideId||again.row.status!==statusFor[phase]||
             ["authUserId","driverId","profileUserId"].some(k=>again.identity?.[k]!==proof.identity[k])||
             !authority.accept(again.row,{epoch:authority.epoch,authUserId:proof.identity.authUserId,
               driverId:proof.identity.driverId,revision:1}))return "unverified";
          await openExternal();
          return current()?"external":"stale";
        }
      }
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
          // Late opened result after revocation. Keep the exact session and
          // audio scope so a real delayed destruction can settle the block.
          this.#blocked=true;
          const closing={id:result.sessionId,rideId,phase,revision:0,releaseAudio,pending:null};
          this.#closing=closing;
          releaseAudio=null;
          nativeUncertain=false;
          await this.#awaitClose(closing);
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
      if(!allowExternalFallback)return "unavailable";
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
      // Do not dispatch a later identical three-field request until the
      // cancellation of the old one has settled; no stale cancel may target it.
      if(ticket.cancel)await ticket.cancel;
      if(this.#busy===ticket)this.#busy=null;
    }
  }
}
