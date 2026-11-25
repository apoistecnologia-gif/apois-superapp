// One unresolved creation per verified account. IndexedDB readwrite transactions
// serialize reservation/clear across WebViews or tabs sharing this origin.
// Never store coordinates, tokens, address, fare or passenger profile.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
export function validEntry(e){
 return e&&Object.keys(e).length===3&&uuid(e.selectionId)&&uuid(e.requestKey)&&uuid(e.owner)
}
const equal=(a,b)=>validEntry(a)&&validEntry(b)&&a.selectionId===b.selectionId&&a.requestKey===b.requestKey&&a.owner===b.owner
export function openRideJournal(factory=globalThis.indexedDB){
 if(!factory)return Promise.reject(Error('Durable journal unavailable'))
 return new Promise((resolve,reject)=>{
  const request=factory.open('apois-navigation-lab-journal-v1',1)
  let failed=false
  request.onupgradeneeded=()=>request.result.createObjectStore('pending')
  request.onerror=()=>{failed=true;reject(request.error)}
  request.onblocked=()=>{failed=true;reject(Error('Journal upgrade blocked'))}
  request.onsuccess=()=>{
   const db=request.result
   if(failed){db.close();return}
   db.onversionchange=()=>db.close()
   function run(scope,mode,action,entry){
    if(!uuid(scope)||(entry!==undefined&&!validEntry(entry)))return Promise.reject(Error('Invalid journal entry'))
    return new Promise((ok,no)=>{
     let tx,answer
     try{tx=db.transaction('pending',mode,mode==='readwrite'?{durability:'strict'}:undefined)
       // Do not silently accept a relaxed durability implementation.
       if(mode==='readwrite'&&tx.durability!=='strict'){tx.abort();throw Error('Strict journal durability unavailable')}
     }catch(e){no(e);return}
     const store=tx.objectStore('pending'),read=store.get(scope)
     tx.onabort=()=>no(tx.error??Error('Journal transaction aborted'))
     tx.onerror=()=>no(tx.error??Error('Journal transaction failed'))
     tx.oncomplete=()=>ok(answer)
     read.onsuccess=()=>{
      const current=read.result
      if(current!==undefined&&!validEntry(current)){tx.abort();return}
      if(action==='read'){answer=current??null;return}
      if(action==='reserve'){
       if(current===undefined){store.add({...entry},scope);answer=true}
       else answer=equal(current,entry)
      }else if(action==='clear'){
       if(equal(current,entry)){store.delete(scope);answer=true}else answer=false
      }
     }
    })
   }
   resolve({read:scope=>run(scope,'readonly','read'),reserve:(scope,e)=>run(scope,'readwrite','reserve',e),clear:(scope,e)=>run(scope,'readwrite','clear',e),close:()=>db.close()})
  }
 })
}
