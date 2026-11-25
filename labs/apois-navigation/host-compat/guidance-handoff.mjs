// Lab-only voice handoff contract. The injected stop functions must resolve
// true ONLY after their queues are stopped and delayed speaks invalidated.
// No preference mutation; operational alerts retain the original voice path.
export class GuidanceHandoff {
  #epoch=0; #state="legacy"; #pending=null; #lease=null;
  #stopLegacy; #stopNative;
  constructor({stopLegacy,stopNative}){this.#stopLegacy=stopLegacy;this.#stopNative=stopNative;}
  get state(){return this.#state;}
  legacyAllowed(){return this.#state==="legacy";}
  current(lease){return this.#state==="native"&&this.#lease===lease&&lease?.epoch===this.#epoch;}
  async acquire(){
    if(this.#state!=="legacy"||this.#pending)return null;
    const epoch=++this.#epoch;
    this.#state="transition";
    const task={epoch,done:null};this.#pending=task;
    try{
      task.done=Promise.resolve().then(()=>this.#stopLegacy());
      const stopped=await task.done;
      if(this.#epoch!==epoch||this.#pending!==task)return null;
      if(stopped!==true){this.#state="blocked";return null;}
      this.#lease=Object.freeze({epoch});
      this.#state="native";return this.#lease;
    }catch{if(this.#epoch===epoch)this.#state="blocked";return null;}
    finally{if(this.#pending===task)this.#pending=null;}
  }
  async release(lease){
    if(!this.current(lease))return false;
    return this.#returnToLegacy();
  }
  // Call synchronously before an operational alert or account revocation.
  // The original alert may proceed only after native guidance is stopped.
  // If stopping fails, caller must retain non-voice notification (visual/
  // vibration) and report the audio handoff failure, not start a second voice.
  async interruptForAlert(){
    if(this.#state==="legacy"&&!this.#pending)return true;
    return this.#returnToLegacy();
  }
  async #returnToLegacy(){
    const previous=this.#pending;
    const epoch=++this.#epoch;
    this.#lease=null;this.#state="transition";
    const task={epoch,done:null};this.#pending=task;
    try{
      // Await the previous operation itself; no late stop may interrupt
      // newly resumed speech. Failure requires an explicit successful stop.
      task.done=(async()=>{
        if(previous?.done)await previous.done.catch(()=>false);
        const native=await this.#stopNative();
        const legacy=await this.#stopLegacy();
        return native===true&&legacy===true;
      })();
      const stopped=await task.done;
      if(this.#epoch!==epoch||this.#pending!==task)return false;
      this.#state=stopped===true?"legacy":"blocked";
      return stopped===true;
    }catch{if(this.#epoch===epoch)this.#state="blocked";return false;}
    finally{if(this.#pending===task)this.#pending=null;}
  }
}
