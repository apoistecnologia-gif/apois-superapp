// Isolated client review; transport must be explicitly provided by the
// experimental host. No default URL, storage or legacy ride submission.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
const cents=v=>Number.isSafeInteger(v)&&v>0
export function createExperimentalRideReview({enabled=false,transport,now=Date.now}={}){
 if(enabled!==true)return null
 if(typeof transport!=='function')throw Error('Missing experimental transport')
 let state='idle',selection=null,quote=null,ride=null,pending=null,uncertain=false
 const snapshot=()=>Object.freeze({state,selection,quote,ride,uncertain})
 const valid=()=>selection&&Number.isFinite(Date.parse(selection.expiresAt))&&Date.parse(selection.expiresAt)>now()
 function begin(s){
  if(state!=='idle'||!uuid(s?.selectionId)||!uuid(s?.requestKey)||!Number.isFinite(Date.parse(s?.expiresAt))||Date.parse(s.expiresAt)<=now())return false
  selection=Object.freeze({selectionId:s.selectionId,requestKey:s.requestKey,expiresAt:s.expiresAt})
  state='selected';return true
 }
 function cancel(){
  // Once a result is uncertain, returning to legacy creation can duplicate a ride.
  if(uncertain||state==='submitting'||state==='created')return false
  pending?.abort();pending=null;selection=quote=ride=null;state='idle';return true
 }
 function parseQuote(b){
  if(!cents(b?.fare_amount_cents)||b.estimated_price!==b.fare_amount_cents/100||
    !Number.isFinite(b.distance_km)||b.distance_km<=0||!Number.isSafeInteger(b.duration_min)||b.duration_min<1||
    !Number.isFinite(Date.parse(b.expiresAt))||Date.parse(b.expiresAt)>Date.parse(selection.expiresAt)||Date.parse(b.expiresAt)<=now())return null
  return Object.freeze({estimated_price:b.estimated_price,fare_amount_cents:b.fare_amount_cents,distance_km:b.distance_km,duration_min:b.duration_min,expiresAt:b.expiresAt})
 }
 const body=action=>({action,selectionId:selection.selectionId,requestKey:selection.requestKey,payment_method:'cash'})
 async function requestQuote(){
  if(!['selected','review'].includes(state)||uncertain||pending)return null
  if(!valid()){state='expired';return null}
  const attempt=new AbortController();pending=attempt;state='quoting';quote=null
  try{
   const response=await transport(body('apois_navigation_quote'),attempt.signal)
   if(pending!==attempt||attempt.signal.aborted)return null
   const q=response?.status===200&&response.body?.ok===true?parseQuote(response.body):null
   quote=q;state=q?'review':valid()?'selected':'expired';return q
  }catch{if(pending===attempt)state=valid()?'selected':'expired';return null}
  finally{if(pending===attempt)pending=null}
 }
 async function submit(explicit=false){
  if(explicit!==true||pending||!['review','uncertain'].includes(state)||!quote)return null
  if(!uncertain&&(!valid()||Date.parse(quote.expiresAt)<=now())){state='expired';return null}
  const previousUncertainty=uncertain,expected=quote.fare_amount_cents
  const attempt=new AbortController();pending=attempt;state='submitting'
  try{
   const response=await transport({...body('apois_navigation_create'),expected_price_cents:expected},attempt.signal)
   const b=response?.body
   if(response?.status===200&&b?.ok===true&&uuid(b.rideId)&&typeof b.reused==='boolean'&&cents(b.fare_amount_cents)&&b.estimated_price===b.fare_amount_cents/100&&(b.reused||b.fare_amount_cents===expected)){
    ride=Object.freeze({rideId:b.rideId,status:b.status,estimated_price:b.estimated_price,fare_amount_cents:b.fare_amount_cents,reused:b.reused});uncertain=false;state='created';return ride
   }
   if(!previousUncertainty&&response?.status===409&&b?.ok===false&&b.error_code==='price_changed'){
    const next=parseQuote(b)
    if(next){quote=next;state='review';return null}
   }
   // Any unconfirmed creation result remains bound to the same key. Never
   // automatically switch to a different quote/key or create an ordinary ride.
   uncertain=true;state='uncertain';return null
  }catch{uncertain=true;state='uncertain';return null}
  finally{if(pending===attempt)pending=null}
 }
 return {snapshot,begin,cancel,requestQuote,submit}
}
