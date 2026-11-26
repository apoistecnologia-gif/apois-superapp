// Candidate PMTiles source for the isolated Northeast WebView. No endpoint configured.
// Manifest parameters must be supplied by a trusted, version-pinned release policy.
// HTTPS and ETag enforce transport/version consistency, not per-range cryptographic proof.
const hex=/^[a-f0-9]{64}$/;
const strongETag=/^"[\x21\x23-\x7e]+"$/;
export function createRangeSource({url,authorizedOrigin,sha256,bytes,etag,fetcher=fetch,maxRange=2*1024*1024,parallel=6}={}){
 if(typeof sha256!=="string"||!hex.test(sha256)||!Number.isSafeInteger(bytes)||bytes<127||!strongETag.test(etag))throw Error("Untrusted archive metadata");
 const origin=new URL(authorizedOrigin),target=new URL(url);
 if(origin.protocol!=="https:"||origin.href!==origin.origin+"/"||origin.username||origin.password||target.origin!==origin.origin||target.username||target.password||target.search||target.hash||target.pathname!=="/maps/nordeste-"+sha256+".pmtiles")throw Error("Archive endpoint not authorized");
 if(!Number.isSafeInteger(maxRange)||maxRange<16384||maxRange>8*1024*1024||!Number.isSafeInteger(parallel)||parallel<1||parallel>16)throw Error("Invalid limits");
 let active=0,closed=false;
 const owner=new AbortController();
 return {
  getKey:()=>target.href,
  close(){closed=true;owner.abort();},
  async getBytes(offset,length,signal,expectedETag){
   if(closed||signal?.aborted)throw new DOMException("Cancelled","AbortError");
   if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||offset>=bytes||length<1||length>maxRange||!Number.isSafeInteger(offset+length))throw Error("Invalid archive range");
   if(expectedETag!==undefined&&expectedETag!==etag)throw Error("Archive version changed");
   if(active>=parallel)throw Error("Range concurrency exceeded");
   const end=Math.min(offset+length,bytes)-1,expected=end-offset+1;
   const abort=new AbortController(),cancel=()=>abort.abort();
   owner.signal.addEventListener("abort",cancel,{once:true});
   signal?.addEventListener("abort",cancel,{once:true});
   if(owner.signal.aborted||signal?.aborted)cancel();
   const timeout=setTimeout(cancel,15000);
   let response,reader;active++;
   try{
    response=await fetcher(target.href,{method:"GET",redirect:"error",credentials:"omit",cache:"default",signal:abort.signal,headers:{Range:"bytes="+offset+"-"+end,"If-Range":etag}});
    if(abort.signal.aborted)throw new DOMException("Cancelled","AbortError");
    if(response.status!==206||response.redirected||response.url&&response.url!==target.href||response.headers.get("ETag")!==etag||response.headers.get("Content-Range")!=="bytes "+offset+"-"+end+"/"+bytes||response.headers.get("Content-Length")!==String(expected)||![null,"identity"].includes(response.headers.get("Content-Encoding"))||!response.body)throw Error("Invalid partial response");
    reader=response.body.getReader();
    const data=new Uint8Array(expected);let n=0;
    while(true){const {done,value}=await reader.read();if(done)break;if(abort.signal.aborted||n+value.byteLength>expected)throw Error("Invalid range body");data.set(value,n);n+=value.byteLength;}
    if(n!==expected||abort.signal.aborted)throw Error("Truncated or cancelled range");
    return {data:data.buffer,etag,cacheControl:response.headers.get("Cache-Control")??undefined,expires:response.headers.get("Expires")??undefined};
   }finally{
    clearTimeout(timeout);
    try{if(reader){await reader.cancel();reader.releaseLock();}else await response?.body?.cancel();}catch{}
    signal?.removeEventListener("abort",cancel);owner.signal.removeEventListener("abort",cancel);active--;
   }
  }
 };
}
