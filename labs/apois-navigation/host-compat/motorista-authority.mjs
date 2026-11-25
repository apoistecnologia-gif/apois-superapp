// Lab-only authority adapter for canonical Motorista status names.
// No credentials, RPCs, network, GPS registration or production import.
// A host must pass freshly verified account/profile and backend snapshots;
// a UI state or client optimistic status is NOT sufficient.
const uuid = v => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const phases = new Map([
  ["motorista_a_caminho","PICKUP"], ["motorista_chegou","WAITING_PIN"], ["em_viagem","TRIP"],
  ["finalizada","COMPLETED"], ["cancelada_passageiro","CANCELLED"], ["cancelada_motorista","CANCELLED"]
]);
const transitions = {
  PICKUP: new Set(["PICKUP","WAITING_PIN","TRIP","CANCELLED"]),
  WAITING_PIN: new Set(["WAITING_PIN","TRIP","CANCELLED"]),
  TRIP: new Set(["TRIP","COMPLETED","CANCELLED"]),
  COMPLETED: new Set(["COMPLETED"]), CANCELLED: new Set(["CANCELLED"])
};
const actions = {
  PICKUP: new Set(["RETURN","REQUEST_EXTERNAL"]),
  WAITING_PIN: new Set(["RETURN","REQUEST_EXTERNAL","OPEN_PIN"]),
  TRIP: new Set(["RETURN","REQUEST_EXTERNAL","FINISH"]),
  COMPLETED: new Set(["RETURN","RATE","SKIP_RATING"]),
  CANCELLED: new Set(["RETURN"])
};
export class MotoristaAuthority {
  #account=null; #state=null; #epoch=0; #pending=null; #closed=false;
  // identity objects must originate from authenticated getUser/profile lookup,
  // not from bridge arguments. Freshness revision is issued by the trusted host.
  bind(identity) {
    if(this.#closed)return false;
    if(!uuid(identity?.authUserId)||!uuid(identity?.driverId)||!uuid(identity?.profileUserId)) {
      this.revoke();return false;
    }
    const next=Object.freeze({authUserId:identity.authUserId,driverId:identity.driverId,profileUserId:identity.profileUserId});
    // public.users.id and auth.users.id are not presumed interchangeable.
    if(this.#account && Object.keys(next).every(k=>next[k]===this.#account[k]))return true;
    this.revoke();
    this.#account=next;
    return true;
  }
  revoke(){this.#account=null;this.#state=null;this.#pending=null;++this.#epoch;}
  close(){this.revoke();this.#closed=true;}
  get epoch(){return this.#epoch;}
  get snapshot(){return this.#state;}
  accept(row,proof) {
    if(!this.#account||this.#closed||proof?.epoch!==this.#epoch||
      proof?.authUserId!==this.#account.authUserId||proof?.driverId!==this.#account.driverId||
      !Number.isSafeInteger(proof.revision)||proof.revision<0||
      !uuid(row?.id))return false;
    const owner=row.accepted_driver_id ?? row.driver_id;
    if(owner!==this.#account.driverId || (row.driver_id!=null&&row.driver_id!==owner))return false;
    const prev=this.#state;
    if(prev && (row.id!==prev.rideId || proof.revision<=prev.revision))return false;
    const phase=phases.get(row.status);
    // Payment pending, queue and unknown/redispatch state must not navigate.
    // A confirmed loss of authorization for the current ride must revoke it.
    if(!phase || row.queued_after_ride_id && phase!=="COMPLETED" && phase!=="CANCELLED") {
      if(prev?.rideId===row.id){this.#state=null;this.#pending=null;++this.#epoch;}
      return false;
    }
    if(!prev&&!["PICKUP","WAITING_PIN","TRIP"].includes(phase))return false;
    if(prev&&!transitions[prev.phase].has(phase))return false;
    this.#state=Object.freeze({rideId:row.id,revision:proof.revision,phase});
    this.#pending=null;
    return true;
  }
  // Host explicitly closes current ride before adopting queued/next ride.
  clearRide(epoch){if(epoch!==this.#epoch)return false;this.#state=null;this.#pending=null;++this.#epoch;return true;}
  authorize(event,epoch){
    const s=this.#state;
    if(!this.#account||!s||epoch!==this.#epoch||this.#pending||
      event?.rideId!==s.rideId||event?.revision!==s.revision||!actions[s.phase].has(event.action))return null;
    if(event.action==="RATE"&&(!Number.isInteger(event.rating)||event.rating<1||event.rating>5))return null;
    if(event.action!=="RATE"&&event.rating!=null)return null;
    // Return only a typed UI intent. Host must recheck verified session/ride
    // before running existing handler; native never receives PIN or price.
    const ticket=Object.freeze({epoch,rideId:s.rideId,revision:s.revision,action:event.action,
      ...(event.action==="RATE"?{rating:event.rating}:{})});
    this.#pending=ticket;return ticket;
  }
  current(ticket){return this.#pending===ticket&&ticket?.epoch===this.#epoch&&this.#state?.rideId===ticket.rideId&&this.#state?.revision===ticket.revision;}
  settle(ticket){if(!this.current(ticket))return false;this.#pending=null;return true;}
}
