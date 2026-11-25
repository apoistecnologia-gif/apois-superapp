// Experimental policy. No production imports, network, timers or live ride mutations.
// Values are lab defaults, NOT field-calibrated limits. All times are monotonic ms.
const defaults=Object.freeze({maxAccuracyM:25, minDeviationM:50, maxFixAgeMs:10000,
  minFixSeparationMs:1000, cooldownMs:15000, windowMs:60000, maxPerWindow:3,
  maxRequestsPerLeg:20});
export function createRerouteGate({rideId,stage,limits={}}){
  if(typeof rideId!=="string"||!rideId.trim()||!["pickup","trip"].includes(stage))throw Error("invalid route session");
  const cfg={...defaults,...limits};
  for(const v of Object.values(cfg))if(!Number.isFinite(v)||v<=0)throw Error("invalid limit");
  let lastFix=-Infinity, lastRequest=-Infinity, pending=null, total=0, sequence=0, consecutive=0, recent=[], closed=false;
  // Return UI state only; never initiate network or switch provider automatically.
  function evaluate({now,fixTime,accuracyM,deviationM,online=true}){
    if(closed)return {action:"ignore",reason:"closed"};
    if(!Number.isFinite(now)||!Number.isFinite(fixTime)||fixTime>now||now-fixTime>cfg.maxFixAgeMs||
       fixTime<=lastFix||fixTime-lastFix<cfg.minFixSeparationMs||
       !Number.isFinite(accuracyM)||accuracyM<0||accuracyM>cfg.maxAccuracyM||
       !Number.isFinite(deviationM)||deviationM<0){
      consecutive=0;
      return {action:"hold",reason:"unreliable_fix",suppressGuidance:true};
    }
    lastFix=fixTime;
    if(deviationM<=cfg.minDeviationM){consecutive=0;return {action:"continue",reason:"on_route"};}
    consecutive++;
    if(consecutive<2)return {action:"hold",reason:"confirm_deviation",suppressGuidance:true};
    if(!online)return {action:"hold",reason:"offline",suppressGuidance:true};
    if(pending!==null)return {action:"hold",reason:"in_flight",suppressGuidance:true};
    recent=recent.filter(t=>now-t<cfg.windowMs);
    if(total>=cfg.maxRequestsPerLeg)return {action:"offer_external",reason:"leg_budget",requiresDriverConfirmation:true,suppressGuidance:true};
    if(now-lastRequest<cfg.cooldownMs||recent.length>=cfg.maxPerWindow)return {action:"hold",reason:"rate_limit",suppressGuidance:true};
    lastRequest=now;recent.push(now);total++;consecutive=0;
    pending=Object.freeze({rideId,stage,sequence:++sequence});
    return {action:"request_route",token:pending,suppressGuidance:true};
  }
  function settle(token){
    // A stale response, including a response to a cancelled ride or changed phase,
    // must never overwrite the navigation session. Caller still validates ride state.
    if(closed||token!==pending||pending===null)return false;
    pending=null;
    return true;
  }
  function close(){closed=true;pending=null;consecutive=0;}
  return Object.freeze({evaluate,settle,close,snapshot:()=>({rideId,stage,total,inFlight:pending!==null,closed})});
}
