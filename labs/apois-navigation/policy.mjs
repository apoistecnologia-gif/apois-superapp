// Experimental policy only; no application imports, storage, or network.
export function chooseNavigation({ enabled=false, ready=false, dataSource="unknown", preferred="google" }={}){
 const external=preferred==="waze"?"waze":"google";
 return enabled===true && ready===true && ["osm","synthetic","independent_gps"].includes(dataSource)
   ? {provider:"ferrostar",fallback:external}
   : {provider:external,fallback:external};
}
export function startSession({rideId,stage,config}){
 if(typeof rideId!=="string"||!rideId.trim()||!["pickup","trip"].includes(stage))throw Error("invalid ride session");
 return Object.freeze({rideId,stage,...chooseNavigation(config)});
}
// No automatic switch, no billing and no operational RPC; explicit driver decision.
export function requestFallback(session,reason){
 if(session.provider!=="ferrostar")return null;
 return {rideId:session.rideId,stage:session.stage,provider:session.fallback,requiresDriverConfirmation:true,reason};
}
