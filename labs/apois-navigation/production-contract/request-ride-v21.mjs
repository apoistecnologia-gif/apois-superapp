// Trusted server-only adapter for the observed request-ride v21 boundary.
// Inject existing account/category/wallet validation, trusted independent
// route metrics, original loadFare, private SQL transport and existing dispatch.
// No network defaults. No user-supplied coordinates, prices or identities.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const fail=(status,error_code)=>({status,body:{ok:false,error_code}})
const point=p=>p&&Object.keys(p).length===2&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.lat>=-9.65&&p.lat<=-9.10&&p.lng>=-40.80&&p.lng<=-40.20
const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0
export function createExperimentalRequestHandler({enabled=false,authorize,readSelection,independentMetrics,loadFare,createAtomic,dispatchInitial,now=Date.now}={}){
 if(enabled!==true)return async()=>fail(409,'experimental_navigation_disabled')
 if(![authorize,readSelection,independentMetrics,loadFare,createAtomic,dispatchInitial].every(f=>typeof f==='function'))throw Error('Missing trusted server adapter')
 return async(session,body)=>{
  const action=body?.action,create=action==='apois_navigation_create'
  if(!body||typeof body!=='object'||Array.isArray(body)||!['apois_navigation_quote','apois_navigation_create'].includes(action))return fail(422,'invalid_experimental_request')
  const allowed=['action','selectionId','requestKey','payment_method',...(create?['expected_price_cents']:[])]
  if(Object.keys(body).length!==allowed.length||Object.keys(body).some(k=>!allowed.includes(k))||
    !uuid(body.selectionId)||!uuid(body.requestKey)||body.payment_method!=='cash'||
    (create&&(!Number.isSafeInteger(body.expected_price_cents)||body.expected_price_cents<=0)))return fail(422,'unsupported_experimental_request')
  const request={...body}
  try{
   const auth=await authorize(session)
   if(!uuid(auth?.authUserId)||!uuid(auth?.categoryId)||auth.allowed!==true)return fail(403,'experimental_not_authorized')
   const args={authUserId:auth.authUserId,selectionId:request.selectionId,requestKey:request.requestKey}
   const selection=await readSelection(args)
   if(!selection)return fail(409,'selection_unavailable')
   const recover=async payload=>{
    const row=await createAtomic(args,payload)
    if(!row||!uuid(row.rideId)||typeof row.reused!=='boolean'||!positive(row.estimated_price)||
       !Number.isSafeInteger(row.fare_amount_cents)||row.fare_amount_cents!==Math.round(row.estimated_price*100))return fail(409,'ride_not_confirmed')
    let candidates=0
    if(!row.reused&&row.status==='procurar_motorista'){
      try{const ids=await dispatchInitial({id:row.rideId});if(Array.isArray(ids))candidates=Math.min(5,ids.length)}catch{/* existing recovery owns dispatch */}
    }
    return {status:200,body:{ok:true,...row,candidates}}
   }
   if(selection.linked===true)return create?recover(null):fail(409,'ride_already_created')
   if(selection.linked!==false||!point(selection.origin)||!point(selection.destination)||!Number.isFinite(Date.parse(selection.expiresAt))||Date.parse(selection.expiresAt)<=now())return fail(409,'selection_expired')
   const origin={...selection.origin},destination={...selection.destination}
   const metrics=await independentMetrics(origin,destination)
   if(metrics?.source!=='OSM_VALHALLA_LAB'||!positive(metrics.distanceKm)||!positive(metrics.durationMin))return fail(503,'independent_route_unavailable')
   const distanceKm=Math.round(metrics.distanceKm*100)/100,durationMin=Math.max(1,Math.ceil(metrics.durationMin))
   if(!positive(distanceKm)||!Number.isSafeInteger(durationMin))return fail(503,'invalid_route_metrics')
   // This is the existing v21 tariff formula adapter, not a client price.
   const price=await loadFare(auth.categoryId,'carros',distanceKm,durationMin,{})
   const cents=Math.round(price*100)
   if(!positive(price)||!Number.isSafeInteger(cents)||cents<=0||price!==cents/100)return fail(503,'invalid_authoritative_fare')
   if(Date.parse(selection.expiresAt)<=now())return fail(409,'selection_expired')
   const quote={estimated_price:price,fare_amount_cents:cents,distance_km:distanceKm,duration_min:durationMin,expiresAt:selection.expiresAt}
   if(!create)return {status:200,body:{ok:true,...quote}}
   if(request.expected_price_cents!==cents)return {status:409,body:{ok:false,error_code:'price_changed',...quote}}
   return await recover({origin,destination,estimated_price:price,distance_km:distanceKm,duration_min:durationMin,
    payment_method:'cash',category:'carros',intermediates:[],expected_price_cents:cents})
  }catch{return fail(503,'experimental_result_uncertain_retry_same_key')}
 }
}
