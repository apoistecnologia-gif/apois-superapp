import {MotoristaAuthority} from './motorista-authority.mjs'
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const phaseStatus=Object.freeze({PICKUP:'motorista_a_caminho',TRIP:'em_viagem'})
// Bound concurrent underlying reads even if an adapter ignores cancellation.
// Token never leaves the supplied Auth adapter; no persistence or logging.
export function createDriverProofReader({getSession,getUser,readProfile,readRide,timeoutMs=5000,maxPending=2}={}){
 if(![getSession,getUser,readProfile,readRide].every(f=>typeof f==='function')||
    !Number.isInteger(timeoutMs)||timeoutMs<50||timeoutMs>5000||!Number.isInteger(maxPending)||maxPending<1||maxPending>4)throw Error('invalid proof reader')
 let pending=0
 return async({rideId,phase}={})=>{
  if(!uuid(rideId)||!Object.hasOwn(phaseStatus,phase)||pending>=maxPending)return null
  const ctrl=new AbortController(),signal=ctrl.signal
  let timer
  const session=async()=>{
   const s=await getSession(signal)
   if(signal.aborted||!uuid(s?.userId)||typeof s?.token!=='string'||!s.token||s.token.length>8192)return null
   return {userId:s.userId,token:s.token}
  }
  const same=(a,b)=>a&&b&&a.userId===b.userId&&a.token===b.token
  const work=async()=>{
   const before=await session();if(!before)return null
   const user=await getUser(before.token,signal);if(signal.aborted||user!==before.userId)return null
   const profile=await readProfile(signal);if(signal.aborted||!uuid(profile?.id)||!uuid(profile?.user_id))return null
   if(!same(before,await session()))return null
   const row=await readRide(rideId,signal);if(signal.aborted||row?.id!==rideId||row.status!==phaseStatus[phase])return null
   if(!same(before,await session()))return null
   const after=await getUser(before.token,signal);if(signal.aborted||after!==before.userId||!same(before,await session()))return null
   const identity={authUserId:before.userId,driverId:profile.id,profileUserId:profile.user_id}
   const authority=new MotoristaAuthority()
   if(!authority.bind(identity)||!authority.accept(row,{epoch:authority.epoch,authUserId:identity.authUserId,driverId:identity.driverId,revision:0}))return null
   return {identity:Object.freeze(identity),row:Object.freeze({id:row.id,status:row.status,driver_id:row.driver_id??null,accepted_driver_id:row.accepted_driver_id??null,category:row.category??null})}
  }
  pending++
  const task=work().catch(()=>null).finally(()=>pending--)
  try{return await Promise.race([task,new Promise(resolve=>{timer=setTimeout(()=>{ctrl.abort();resolve(null)},timeoutMs)})])}
  finally{clearTimeout(timer)}
 }
}
