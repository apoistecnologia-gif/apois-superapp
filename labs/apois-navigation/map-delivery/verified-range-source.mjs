// Experimental bounded PMTiles source. The host must pin an independently
// authenticated manifest digest; a URL or an ETag alone is not authentication.
import {createRangeSource} from './range-source.mjs'
const hex=/^[a-f0-9]{64}$/
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k))
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('')
export async function verifiedManifest(raw,pinned){
 if(!(raw instanceof Uint8Array)||raw.byteLength<1||raw.byteLength>2*1024*1024||typeof pinned!=='string'||!hex.test(pinned))throw Error('Manifest pin required')
 const copy=raw.slice()
 if(await sha(copy)!==pinned)throw Error('Untrusted chunk manifest')
 const m=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(copy))
 if(!exact(m,['format','archiveSha256','bytes','chunkBytes','chunks'])||m.format!=='APOIS-PMTILES-CHUNKS-v1'||typeof m.archiveSha256!=='string'||!hex.test(m.archiveSha256)||!Number.isSafeInteger(m.bytes)||m.bytes<127||!Number.isSafeInteger(m.chunkBytes)||m.chunkBytes<65536||m.chunkBytes>2097152||!Array.isArray(m.chunks)||m.chunks.length!==Math.ceil(m.bytes/m.chunkBytes)||!m.chunks.every(x=>typeof x==='string'&&hex.test(x)))throw Error('Invalid chunk manifest')
 return Object.freeze({...m,chunks:Object.freeze([...m.chunks])})
}
export async function createVerifiedRangeSource({manifestBytes,expectedManifestSha256,url,authorizedOrigin,etag,fetcher,parallel=4,cacheChunks=4,maxRead=2*1024*1024}={}){
 const m=await verifiedManifest(manifestBytes,expectedManifestSha256)
 if(!Number.isSafeInteger(cacheChunks)||cacheChunks<0||cacheChunks>8||!Number.isSafeInteger(maxRead)||maxRead<16384||maxRead>8*1024*1024||!Number.isSafeInteger(parallel)||parallel<1||parallel>8)throw Error('Invalid verified range limits')
 const transport=createRangeSource({url,authorizedOrigin,sha256:m.archiveSha256,bytes:m.bytes,etag,fetcher,parallel,maxRange:m.chunkBytes})
 const cache=new Map();let active=0,closed=false
 const owner=new AbortController()
 const abortError=()=>new DOMException('Cancelled','AbortError')
 const readChunk=async(index,signal)=>{
  if(signal.aborted)throw abortError()
  const cached=cache.get(index)
  if(cached){cache.delete(index);cache.set(index,cached);return cached}
  const start=index*m.chunkBytes,expected=Math.min(m.chunkBytes,m.bytes-start)
  const result=await transport.getBytes(start,expected,signal,etag)
  const bytes=new Uint8Array(result.data)
  if(bytes.length!==expected||await sha(bytes)!==m.chunks[index])throw Error('Map chunk integrity failure')
  if(signal.aborted)throw abortError()
  if(cacheChunks){cache.set(index,bytes);while(cache.size>cacheChunks)cache.delete(cache.keys().next().value)}
  return bytes
 }
 return {
  getKey:()=>transport.getKey(),
  close(){closed=true;owner.abort();cache.clear();transport.close()},
  async getBytes(offset,length,signal,expectedETag){
   if(closed||signal?.aborted)throw abortError()
   if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||offset>=m.bytes||length<1||length>maxRead||!Number.isSafeInteger(offset+length))throw Error('Invalid verified range')
   if(expectedETag!==undefined&&expectedETag!==etag)throw Error('Archive version changed')
   if(active>=parallel)throw Error('Verified range concurrency exceeded')
   active++
   const combined=signal?AbortSignal.any([owner.signal,signal]):owner.signal
   try{
    const end=Math.min(offset+length,m.bytes),data=new Uint8Array(end-offset)
    for(let i=Math.floor(offset/m.chunkBytes);i<=Math.floor((end-1)/m.chunkBytes);i++){
     const chunk=await readChunk(i,combined),start=i*m.chunkBytes,lo=Math.max(offset,start),hi=Math.min(end,start+chunk.length)
     data.set(chunk.subarray(lo-start,hi-start),lo-offset)
    }
    if(combined.aborted)throw abortError()
    // Return a fresh buffer: PMTiles callers cannot mutate verified cache.
    return {data:data.buffer,etag}
   }finally{active--}
  }
 }
}
