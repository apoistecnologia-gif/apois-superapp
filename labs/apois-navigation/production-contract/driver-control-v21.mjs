// Server-only. Backend authentication, fresh v21 proof and issuance must be
// injected by a trusted process. No keys, network endpoints or defaults.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k))
const point=p=>exact(p,['lat','lon'])&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&p.lat>=-9.65&&p.lat<=-9.10&&p.lon>=-40.80&&p.lon<=-40.20
const status={PICKUP:'motorista_a_caminho',TRIP:'em_viagem'}
const fail=(status,error_code)=>({status,body:{ok:false,error_code}})
const tokenFormat=/^[A-Za-z0-9_-]{1,1500}\.[A-Za-z0-9_-]{86}$/
export function trustedTarget(proof,rideId,phase,now){
 const e=proof?.targetEvidence
 if(!uuid(proof?.authUserId)||!uuid(proof?.profileUserId)||!uuid(proof?.driverId)||
    proof.rideId!==rideId||!Object.hasOwn(status,phase)||proof.status!==status[phase]||
    proof.assignedDriverId!==proof.driverId||proof.acceptedDriverId!==proof.driverId||
    proof.category!=='carros'||proof.intermediateStops!==0||
    !Number.isSafeInteger(now)||!Number.isSafeInteger(proof.verifiedAt)||proof.verifiedAt>now||now-proof.verifiedAt>5000||
    !uuid(e?.id)||!Number.isSafeInteger(e.version)||e.version<1||e.version>2147483647||
    e.rideId!==rideId||e.phase!==phase||e.source!=='INDEPENDENT_OSM'||!point(e.point))return null
 return Object.freeze({rideId,phase,identity:Object.freeze({authUserId:proof.authUserId,profileUserId:proof.profileUserId,driverId:proof.driverId}),evidence:Object.freeze({id:e.id,version:e.version,source:e.source,point:Object.freeze({...e.point})})})
}
export function createDriverControl({enabled=false,authority,issuePermit,allowPilot=()=>false,now=Date.now,timeout=5000,maxPending=4}={}){
 if(enabled!==true)return async()=>fail(409,'experimental_navigation_disabled')
 if(![authority,issuePermit,allowPilot,now].every(f=>typeof f==='function')||!Number.isSafeInteger(timeout)||timeout<1||timeout>5000||!Number.isSafeInteger(maxPending)||maxPending<1||maxPending>32)throw Error('Trusted driver dependencies required')
 let pending=0
 const handle=async(session,request,signal)=>{
  if(!(signal instanceof AbortSignal)||signal.aborted)return fail(503,'navigation_unavailable')
  const target=request?.action==='target',permit=request?.action==='permit'
  if(!target&&!permit)return fail(422,'invalid_driver_request')
  if(!exact(request,target?['action','rideId','phase']:['action','rideId','phase','origin','evidenceId','evidenceVersion'])||
   !uuid(request.rideId)||!Object.hasOwn(status,request.phase)||
   (permit&&(!point(request.origin)||!uuid(request.evidenceId)||!Number.isSafeInteger(request.evidenceVersion)||request.evidenceVersion<1)))return fail(422,'invalid_driver_request')
  if(typeof session!=='string'||!session.length||session.length>8192||/\s|[\x00-\x1f\x7f]/.test(session))return fail(401,'unauthorized')
  const req={rideId:request.rideId,phase:request.phase}
  const input=permit?{origin:{...request.origin},evidenceId:request.evidenceId,evidenceVersion:request.evidenceVersion}:null
  try{
   const proof=await authority(session,req,signal)
   const result=trustedTarget(proof,req.rideId,req.phase,now())
   if(signal.aborted)return fail(503,'navigation_unavailable')
   if(!result||await allowPilot(result.identity.authUserId)!==true)return fail(403,'driver_not_authorized')
   if(signal.aborted)return fail(503,'navigation_unavailable')
   if(target)return {status:200,body:{ok:true,target:result}}
   if(input.evidenceId!==result.evidence.id||input.evidenceVersion!==result.evidence.version)return fail(409,'target_changed')
   // The issuer independently authenticates and loads fresh proof again.
   // Client cannot choose the target, driver, provenance or scope.
   const issued=await issuePermit(session,{...req,origin:input.origin,target:{...result.evidence.point}},signal)
   if(signal.aborted)return fail(503,'navigation_unavailable')
   if(issued?.status!==200||typeof issued.token!=='string'||!tokenFormat.test(issued.token))return fail(issued?.status===429?429:issued?.status===403?403:503,'permit_unavailable')
   return {status:200,body:{ok:true,rideId:req.rideId,phase:req.phase,evidenceId:result.evidence.id,evidenceVersion:result.evidence.version,token:issued.token}}
  }catch{return fail(503,'navigation_unavailable')}
 }
 return async(session,request,signal)=>{
  if(signal!==undefined&&(!(signal instanceof AbortSignal)||signal.aborted))return fail(503,'navigation_unavailable')
  if(pending>=maxPending)return fail(429,'navigation_busy')
  const controller=new AbortController();let timer,onAbort
  pending++
  const work=handle(session,request,controller.signal)
  // Non-cooperative adapters occupy capacity until they actually settle.
  work.then(()=>pending--,()=>pending--)
  try{
   const deadline=new Promise(resolve=>{
    onAbort=()=>{controller.abort();resolve(fail(503,'navigation_unavailable'))}
    timer=setTimeout(onAbort,timeout);signal?.addEventListener('abort',onAbort,{once:true});if(signal?.aborted)onAbort()
   })
   return await Promise.race([work,deadline])
  }finally{clearTimeout(timer);if(onAbort)signal?.removeEventListener('abort',onAbort)}
 }
}
