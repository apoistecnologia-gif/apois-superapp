// Synthetic WebView host. No real data, no RPC, no network routes.
export function createDemo(bridge,{schedule=setTimeout,unschedule=clearTimeout,onStatus=()=>{}}={}){
 let current=null, listener=null, timer=null, starting=false, queue=Promise.resolve(), disposed=false;
 const serialize=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
 function cancelTimer(){if(timer!==null){unschedule(timer);timer=null;}}
 async function closeCurrent(){
   cancelTimer();const old=current;current=null;
   if(old)await bridge.close({sessionId:old.sessionId});
   onStatus("Sessão encerrada");
 }
 async function next(phase,extras={}){
   if(!current)return false;
   const c=current;
   const snapshot={...c.snapshot,...extras,phase,revision:c.snapshot.revision+1};
   const r=await bridge.update({sessionId:c.sessionId,snapshot});
   if(r.accepted!==true){await closeCurrent();return false;}
   c.snapshot=snapshot;onStatus(phase);return true;
 }
 async function event(e){
   const c=current;
   if(!c||e.sessionId!==c.sessionId||e.rideId!==c.snapshot.rideId)return;
   if(e.action==="SESSION_CLOSED"){cancelTimer();current=null;onStatus("Sessão encerrada");return;}
   if(e.revision!==c.snapshot.revision)return;
   const phase=c.snapshot.phase;
   if(e.action==="OPEN_PIN"&&phase==="WAITING_PIN")await next("TRIP",{destination:"Destino fictício — etapa 2"});
   else if(e.action==="FINISH"&&phase==="TRIP")await next("COMPLETED");
   else if(e.action==="RATE"&&phase==="COMPLETED"&&Number.isInteger(e.rating)&&e.rating>=1&&e.rating<=5)await closeCurrent();
   else if(e.action==="SKIP_RATING"&&phase==="COMPLETED")await closeCurrent();
   else if(e.action==="RETURN"||e.action==="REQUEST_EXTERNAL")await closeCurrent();
 }
 return {
   async start(scenario){
     if(disposed||starting)throw Error("Laboratório indisponível");
     if(!["full","cancel","trip"].includes(scenario))throw Error("Cenário inválido");
     starting=true;
     try{return await serialize(async()=>{
       await closeCurrent();
       if(!listener)listener=await bridge.addListener("rideIntent",e=>{void serialize(()=>event(e)).catch(()=>onStatus("Falha no evento de teste"));});
       const snapshot={rideId:"lab-"+scenario,revision:1,phase:scenario==="trip"?"TRIP":"PICKUP",destination:"Embarque fictício — etapa 1"};
       const r=await bridge.open(snapshot);
       if(typeof r.sessionId!=="string"||!r.sessionId)throw Error("Sessão inválida");
       current={sessionId:r.sessionId,snapshot};
       onStatus(snapshot.phase);
       if(scenario!=="trip"){
         const id=r.sessionId;
         timer=schedule(()=>{void serialize(async()=>{
           if(current?.sessionId!==id||current.snapshot.phase!=="PICKUP")return;
           await next(scenario==="cancel"?"CANCELLED":"WAITING_PIN");
         }).catch(()=>onStatus("Falha na transição de teste"));},scenario==="cancel"?8000:12000);
       }
       return r.sessionId;
     });}finally{starting=false;}
   },
   close:()=>serialize(closeCurrent),
   async dispose(){disposed=true;await serialize(async()=>{await closeCurrent();await listener?.remove();listener=null;});},
   // only for tests / diagnostics, not authoritative production state
   state:()=>current?{sessionId:current.sessionId,...current.snapshot}:null,
   idle:()=>queue
 };
}
