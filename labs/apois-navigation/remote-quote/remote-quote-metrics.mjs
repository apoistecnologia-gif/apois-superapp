import {createQuoteSigner,quoteBody} from './quote-protocol.mjs'
// Configured endpoint only; no public OSM/Google fallback and no default URL.
// Call with authUserId from verified server session, never a JSON body field.
export async function createRemoteQuoteMetrics({endpoint,keyId,secret,authUserId,fetcher=fetch,now=Date.now}){
 const url=new URL(endpoint)
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/quote/route'||!url.hostname||url.hostname.startsWith('[')||/^\d+(\.\d+){3}$/.test(url.hostname))throw Error('Invalid HTTPS quote endpoint')
 const signer=await createQuoteSigner({keyId,secret,authUserId,now})
 return async(origin,destination)=>{
  const body=quoteBody(origin,destination);if(!body)return null
  const authorization=await signer(body)
  const response=await fetcher(url.href,{method:'POST',redirect:'error',signal:AbortSignal.timeout(6000),headers:{authorization,'content-type':'application/json'},body:JSON.stringify(body)})
  if(!response.ok||!response.body){await response.body?.cancel();return null}
  const reader=response.body.getReader();let bytes=0,chunks=[]
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2000000){await reader.cancel();return null}chunks.push(value)}}finally{reader.releaseLock()}
  const all=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.byteLength}
  const payload=JSON.parse(new TextDecoder().decode(all)),route=payload?.routes?.[0]
  if(payload?.code!=='Ok'||!Number.isFinite(route?.distance)||!Number.isFinite(route?.duration)||route.distance<=0||route.duration<=0)return null
  return {source:'OSM_VALHALLA_LAB',distanceKm:route.distance/1000,durationMin:route.duration/60}
 }
}
