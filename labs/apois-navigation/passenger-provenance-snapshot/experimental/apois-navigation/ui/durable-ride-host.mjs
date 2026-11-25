import {createExperimentalRideReview} from './request-review.mjs'
import {validEntry} from './ride-journal.mjs'
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const activeStatuses=new Set(['agendada','aguardando_pagamento','procurar_motorista','motorista_a_caminho','motorista_chegou','em_viagem'])
const terminalStatuses=new Set(['finalizada','cancelada_passageiro','cancelada_motorista','expired'])
const validRide=r=>uuid(r?.rideId)&&activeStatuses.has(r.status)
export function createDurableRideHost({enabled=false,journal,verifyIdentity,activeRide,transport,now=Date.now,newOwner=()=>crypto.randomUUID()}={}){
 if(enabled!==true)return null
 if(!journal||!['read','reserve','clear'].every(k=>typeof journal[k]==='function')||![verifyIdentity,activeRide,transport].every(f=>typeof f==='function'))throw Error('Missing durable host dependency')
 let state='closed',scope=null,pendingEntry=null,review=null,ride=null,generation=0,busy=false,owner=null
 const snapshot=()=>Object.freeze({state,ride,review:review?.snapshot()??null,pending:!!pendingEntry})
 const current=async(epoch)=>generation===epoch&&uuid(scope)&&await verifyIdentity()===scope&&generation===epoch
 const inspectActive=async(epoch)=>{
  const result=await activeRide(scope)
  if(!await current(epoch))throw Error('Account changed')
  // A null/invalid response is not proof of absence.
  if(result?.verified!==true||!Object.hasOwn(result,'ride'))throw Error('Active ride unverified')
  if(result.ride===null)return null
  if(!validRide(result.ride))throw Error('Invalid active ride')
  return {rideId:result.ride.rideId,status:result.ride.status}
 }
 function invalidate(){generation++;state='closed';scope=pendingEntry=review=ride=owner=null;busy=false}
 async function open(){
  if(state!=='closed'||busy)return false
  const epoch=++generation;busy=true;state='checking'
  try{
   const identity=await verifyIdentity()
   if(generation!==epoch)return false
   if(!uuid(identity))throw Error('Invalid account')
   scope=identity;owner=newOwner();if(!uuid(owner))throw Error('Invalid owner')
   const stored=await journal.read(scope)
   if(!await current(epoch))throw Error('Account changed')
   if(stored!==null&&!validEntry(stored))throw Error('Invalid journal')
   pendingEntry=stored
   ride=await inspectActive(epoch)
   if(pendingEntry){state='recovery';return true}
   if(ride){state='active';return true}
   review=createExperimentalRideReview({enabled:true,now,transport:async(body,signal)=>{
    const requestEpoch=epoch
    if(!await current(requestEpoch)||signal.aborted)throw Error('Account changed')
    if(body.action==='apois_navigation_create'){
     const entry={selectionId:body.selectionId,requestKey:body.requestKey,owner}
     if(!await journal.reserve(scope,entry))throw Error('Concurrent creation')
     if(!await current(requestEpoch)||signal.aborted)throw Error('Account changed')
     pendingEntry=entry
    }
    const result=await transport(body,signal)
    if(!await current(requestEpoch))throw Error('Account changed')
    return result
   }})
   state='ready';return true
  }catch{if(generation===epoch)state='blocked';return false}
  finally{if(generation===epoch)busy=false}
 }
 function begin(selection){return state==='ready'&&!busy&&review.begin(selection)}
 async function quote(){
  if(state!=='ready'||busy)return null
  const epoch=generation;busy=true
  try{return await review.requestQuote()}finally{if(generation===epoch)busy=false}
 }
 async function submit(explicit=false){
  if(state!=='ready'||busy||explicit!==true)return null
  const epoch=generation;busy=true
  try{
   const result=await review.submit(true)
   if(generation!==epoch)return null
   if(result){ride={rideId:result.rideId,status:result.status};state='active'}
   else if(review.snapshot().state==='uncertain')state='recovery'
   return result
  }finally{if(generation===epoch)busy=false}
 }
 async function recover({seal=false}={}){
  if((!['recovery','active','blocked'].includes(state)&&!(state==='ready'&&pendingEntry))||busy||!uuid(scope))return false
  const epoch=generation;busy=true
  try{
   if(!await current(epoch))throw Error('Account changed')
   const record=await journal.read(scope)
   if(!await current(epoch))throw Error('Account changed')
   if(record!==null&&!validEntry(record))throw Error('Invalid journal')
   pendingEntry=record
   if(!record){ride=await inspectActive(epoch);state=ride?'active':'ready-to-reopen';return true}
   const response=await transport({action:seal?'apois_navigation_seal':'apois_navigation_recover',selectionId:record.selectionId,requestKey:record.requestKey},AbortSignal.timeout(10000))
   if(!await current(epoch))throw Error('Account changed')
   const b=response?.body
   if(response?.status!==200||b?.ok!==true||b.requestKey!==record.requestKey||b.selectionId!==record.selectionId)throw Error('Unverified recovery')
   if(b.state==='ride'&&validRide(b.ride)){ride={rideId:b.ride.rideId,status:b.ride.status};state='active';return true}
   if(b.state==='sealed'||(b.state==='ride'&&uuid(b.ride?.rideId)&&terminalStatuses.has(b.ride.status))){
    const active=await inspectActive(epoch)
    if(!await journal.clear(scope,record)||!await current(epoch))throw Error('Journal changed')
    pendingEntry=null;ride=active;state=active?'active':'ready-to-reopen';return true
   }
   state='recovery';return false
  }catch{if(generation===epoch)state='blocked';return false}
  finally{if(generation===epoch)busy=false}
 }
 // No automatic creation/retry on restart. Explicit seal only fences the old
 // uncreated selection; it never cancels an existing ride.
 return {snapshot,open,begin,quote,submit,recover,invalidate,canReturnToLegacy:()=>!busy&&!pendingEntry&&(state==='ready'||state==='ready-to-reopen')&&(!review||['idle','selected','review','expired'].includes(review.snapshot().state))}
}
