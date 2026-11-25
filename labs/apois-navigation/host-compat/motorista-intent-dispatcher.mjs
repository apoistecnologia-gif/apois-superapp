// Experimental dispatcher. Inject ONLY original host UI/operation handlers.
// No Capacitor registration, backend calls, auth tokens, or automatic actions.
export class MotoristaIntentDispatcher {
  #authority; #handlers; #verify; #session=null; #busy=null; #closed=false;
  #uncertainFinish=null;
  constructor(authority,{verify,handlers}){
    this.#authority=authority;this.#verify=verify;this.#handlers=handlers;
  }
  attach(sessionId){
    if(this.#closed||this.#busy||this.#uncertainFinish||this.#session||
      typeof sessionId!=="string"||!sessionId||sessionId.length>128||!this.#authority.snapshot)return false;
    this.#session=Object.freeze({id:sessionId,epoch:this.#authority.epoch});
    return true;
  }
  detach(sessionId){
    if(this.#session?.id!==sessionId)return false;
    this.#session=null;return true;
  }
  close(){this.#session=null;this.#closed=true;}
  // An ambiguous finish result is not a retry permission. The host must
  // obtain a fresh authoritative reconciliation AND explicit user approval.
  // Even then the original backend remains responsible for idempotency.
  acknowledgeFinishReconciled({epoch,rideId,revision,explicitRetry=false}={}){
    const u=this.#uncertainFinish,s=this.#authority.snapshot;
    if(!u||this.#busy||!s||epoch!==this.#authority.epoch||epoch!==u.epoch||
       rideId!==u.rideId||s.rideId!==rideId||revision!==s.revision||revision<=u.revision)return false;
    if(s.phase!=="COMPLETED"&&s.phase!=="CANCELLED"&&!(s.phase==="TRIP"&&explicitRetry===true))return false;
    this.#uncertainFinish=null;return true;
  }
  // Explicit account/ride invalidation can discard a previous account's
  // uncertainty only after all handlers are settled.
  discardRevokedFinish(){
    if(this.#busy||!this.#uncertainFinish||this.#uncertainFinish.epoch===this.#authority.epoch)return false;
    this.#uncertainFinish=null;return true;
  }
  async receive(event){
    const session=this.#session;
    if(!session||this.#closed||event?.sessionId!==session.id)return "ignored";
    if(event.action==="SESSION_CLOSED"){this.detach(session.id);return "closed";}
    if(this.#busy||session.epoch!==this.#authority.epoch||
       (event.action==="FINISH"&&this.#uncertainFinish))return "blocked";
    const ticket=this.#authority.authorize(event,session.epoch);
    if(!ticket)return "blocked";
    this.#busy=ticket;
    let invoked=false;
    const current=()=>!this.#closed&&this.#session===session&&
      this.#busy===ticket&&this.#authority.current(ticket);
    try{
      // Must resolve true only after fresh host verification of account,
      // assignment and phase; do not increment the UI revision for an
      // unchanged authoritative row. If changed, reconcile and return false.
      if(await this.#verify(ticket)!==true||!current())return "stale";
      const handler=this.#handlers[ticket.action];
      if(typeof handler!=="function")return "unavailable";
      // Handler must capture this exact rideId and not read activeRef after
      // an await. Native PIN, price or arbitrary fields are never forwarded.
      invoked=true;
      const result=await handler(ticket);
      // Success requires explicit handler acknowledgement; backend confirmation
      // of finalization still arrives through the existing authoritative path.
      if(ticket.action==="FINISH" && result!==true){
        this.#uncertainFinish=ticket;return "reconcile";
      }
      // Do not turn a stale response into a new UI action.
      return current() ? (result===true?"handled":"rejected") : "stale";
    } catch {
      if(invoked&&ticket.action==="FINISH"){
        this.#uncertainFinish=ticket;return "reconcile";
      }
      return current()?"failed":"stale";
    } finally {
      this.#authority.settle(ticket);
      if(this.#busy===ticket)this.#busy=null;
    }
  }
}
