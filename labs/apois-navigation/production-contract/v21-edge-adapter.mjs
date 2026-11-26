// Adapter of the observed v21 function; only call from a verified server context.
import {createExperimentalRequestHandler} from './request-ride-v21.mjs'
export function localValhallaMetrics(fetcher=fetch){
 return async(origin,destination)=>{
  const response=await fetcher('http://127.0.0.1:8002/route',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{'content-type':'application/json'},
   body:JSON.stringify({locations:[{lat:origin.lat,lon:origin.lng},{lat:destination.lat,lon:destination.lng}],costing:'auto',units:'kilometers',language:'pt-BR',format:'osrm',shape_format:'polyline6'})
  })
  if(!response.ok||!response.body)return null
  const reader=response.body.getReader();let bytes=0,chunks=[]
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1048576){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}
  const all=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength}
  const payload=JSON.parse(new TextDecoder().decode(all)),route=payload?.routes?.[0]
  if(payload?.code!=='Ok'||typeof route?.distance!=='number'||typeof route?.duration!=='number'||!Number.isFinite(route.distance)||!Number.isFinite(route.duration)||route.distance<=0||route.duration<=0)return null
  return {source:'OSM_VALHALLA_LAB',distanceKm:route.distance/1000,durationMin:route.duration/60}
 }
}
/**
 * @typedef {{lat:number,lng:number}} RoutePoint
 * @param {{enabled?:boolean,admin?:{rpc:(name:string,args:Record<string,unknown>)=>PromiseLike<{data:unknown,error:unknown}>,from:(table:string)=>{select:(columns:string)=>any}},authUserId?:string,passengerId?:string,independentMetrics?:(origin:RoutePoint,destination:RoutePoint)=>Promise<{source:string,distanceKm:number,durationMin:number}|null>,loadFare?:(categoryId:string,category:string,km:number,min:number,details:Record<string,unknown>)=>Promise<number>,dispatchInitial?:(ride:{id:string})=>Promise<string[]>,verifyCurrentSession?:()=>Promise<boolean>}} [options]
 */
export function createV21ExperimentalAction({enabled=false,admin,authUserId,passengerId,independentMetrics,loadFare,dispatchInitial,verifyCurrentSession}={}){
 if(enabled!==true)return createExperimentalRequestHandler()
 if(typeof verifyCurrentSession!=='function')throw Error('Missing explicit session verifier')
 async function rpc(name,args){
  const {data,error}=await admin.rpc(name,args)
  if(error)throw Error('private experimental SQL failed')
  return data
 }
 const params=({authUserId,selectionId,requestKey})=>({p_auth_user:authUserId,p_selection:selectionId,p_request_key:requestKey})
 const handler=createExperimentalRequestHandler({enabled:true,
  authorize:async()=>{
   const {data:wallet,error:walletError}=await admin.from('passenger_wallets').select('is_blocked').eq('passenger_id',passengerId).maybeSingle()
   if(walletError||wallet?.is_blocked)return null
   const {data:category,error:categoryError}=await admin.from('ride_categories').select('id,code').eq('code','carros').eq('is_active',true).maybeSingle()
   if(categoryError||category?.code!=='carros')return null
   return {authUserId,categoryId:category.id,allowed:true}
  },
  readSelection:args=>rpc('apois_nav_lab_read_selection_v21',params(args)),
  createAtomic:(args,payload)=>rpc('apois_nav_lab_create_ride_v21',{...params(args),p_payload:payload}),
  independentMetrics,loadFare,dispatchInitial,revalidate:verifyCurrentSession
 })
 return body=>handler(null,body)
}
