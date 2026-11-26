// Bounded queue for actual MapLibre protocol requests. No retry or unbounded
// buffering; a cancelled tile never starts new IO. Each active slot lasts
// until its task really settles (even if it ignores cancellation).
export function createTileScheduler({parallel=4,maxQueued=32}={}){
 if(!Number.isSafeInteger(parallel)||parallel<1||parallel>8||!Number.isSafeInteger(maxQueued)||maxQueued<0||maxQueued>64)throw Error('Invalid tile queue limits')
 let active=0,closed=false
 const pending=[],owner=new AbortController()
 const cancelled=()=>new DOMException('Cancelled','AbortError')
 function pump(){
  while(!closed&&active<parallel&&pending.length){
   const item=pending.shift()
   item.signal.removeEventListener('abort',item.onAbort)
   if(item.signal.aborted){item.reject(cancelled());continue}
   active++
   Promise.resolve().then(()=>{if(item.signal.aborted)throw cancelled();return item.task(item.signal)}).then(value=>{
    if(item.signal.aborted)item.reject(cancelled());else item.resolve(value)
   },item.reject).finally(()=>{active--;pump()})
  }
 }
 return {
  run(task,signal){
   if(typeof task!=='function')return Promise.reject(Error('Tile task required'))
   if(closed||signal?.aborted)return Promise.reject(cancelled())
   if(active>=parallel&&pending.length>=maxQueued)return Promise.reject(Error('Tile queue full'))
   const combined=signal?AbortSignal.any([owner.signal,signal]):owner.signal
   return new Promise((resolve,reject)=>{
    const item={task,signal:combined,resolve,reject,onAbort:()=>{const i=pending.indexOf(item);if(i>=0){pending.splice(i,1);combined.removeEventListener('abort',item.onAbort);reject(cancelled())}}}
    pending.push(item);combined.addEventListener('abort',item.onAbort,{once:true});pump()
   })
  },
  close(){if(closed)return;closed=true;owner.abort()}
 }
}
