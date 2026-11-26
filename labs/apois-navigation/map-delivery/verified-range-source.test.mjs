import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {createVerifiedRangeSource,verifiedManifest} from './verified-range-source.mjs'
const digest=b=>createHash('sha256').update(b).digest('hex')
const bytes=Uint8Array.from({length:140000},(_,i)=>i%251),chunkBytes=65536
const sha256=digest(bytes),origin='https://maps.example.invalid',etag='"release"'
const manifest={format:'APOIS-PMTILES-CHUNKS-v1',archiveSha256:sha256,bytes:bytes.length,chunkBytes,chunks:[0,1,2].map(i=>digest(bytes.subarray(i*chunkBytes,(i+1)*chunkBytes)))}
const raw=new TextEncoder().encode(JSON.stringify(manifest))
const config={manifestBytes:raw,expectedManifestSha256:digest(raw),url:origin+'/maps/nordeste-'+sha256+'.pmtiles',authorizedOrigin:origin,etag}
function fixture(corrupt=false){
 let calls=0
 return {get calls(){return calls},fetcher:async(_,o)=>{
  calls++;const [start,end]=o.headers.Range.slice(6).split('-').map(Number)
  const body=bytes.slice(start,end+1);if(corrupt)body[0]^=1
  return new Response(body,{status:206,headers:{ETag:etag,'Content-Range':'bytes '+start+'-'+end+'/'+bytes.length,'Content-Length':String(body.length)}})
 }}
}
test('verified ranges cross chunk boundaries, truncate EOF and isolate cache from caller',async()=>{
 const f=fixture(),s=await createVerifiedRangeSource({...config,fetcher:f.fetcher})
 const r=await s.getBytes(65530,20);assert.deepEqual(new Uint8Array(r.data),bytes.slice(65530,65550));assert.equal(f.calls,2)
 new Uint8Array(r.data).fill(0);assert.deepEqual(new Uint8Array((await s.getBytes(65530,20)).data),bytes.slice(65530,65550));assert.equal(f.calls,2)
 assert.deepEqual(new Uint8Array((await s.getBytes(bytes.length-5,20)).data),bytes.slice(-5));s.close()
 await assert.rejects(s.getBytes(0,10),/Cancelled/)
})
test('valid HTTP headers cannot authenticate corrupt bytes',async()=>{
 const f=fixture(true),s=await createVerifiedRangeSource({...config,fetcher:f.fetcher})
 await assert.rejects(s.getBytes(0,20),/integrity/);await assert.rejects(s.getBytes(0,20),/integrity/);assert.equal(f.calls,2)
})
test('manifest pin and chunk count are checked before any request',async()=>{
 const f=fixture()
 await assert.rejects(createVerifiedRangeSource({...config,expectedManifestSha256:'0'.repeat(64),fetcher:f.fetcher}),/Untrusted/)
 const altered=new TextEncoder().encode(JSON.stringify({...manifest,chunks:manifest.chunks.slice(0,2)}))
 await assert.rejects(verifiedManifest(altered,digest(altered)),/Invalid/)
 assert.equal(f.calls,0)
})
test('cache is bounded and request cancellation releases capacity',async()=>{
 const f=fixture(),s=await createVerifiedRangeSource({...config,fetcher:f.fetcher,cacheChunks:1,parallel:1})
 await s.getBytes(0,20);await s.getBytes(chunkBytes,20);await s.getBytes(0,20);assert.equal(f.calls,3)
 const c=new AbortController();c.abort();await assert.rejects(s.getBytes(0,20,c.signal),/Cancelled/);assert.equal(f.calls,3)
})

test('manifest verification uses one immutable snapshot even for Node Buffer',async()=>{
 const original=Buffer.from(raw),pin=digest(original)
 const pending=verifiedManifest(original,pin)
 original.fill(0)
 const checked=await pending
 assert.equal(checked.archiveSha256,sha256)
 assert.deepEqual(checked.chunks,manifest.chunks)
})

test('overlapping reads share an authenticated chunk without sharing cancellation',async()=>{
 const f=fixture(),started=Promise.withResolvers(),release=Promise.withResolvers()
 const s=await createVerifiedRangeSource({...config,fetcher:async(...args)=>{started.resolve();await release.promise;return f.fetcher(...args)}})
 const c=new AbortController(),first=s.getBytes(0,20,c.signal)
 await started.promise
 const second=s.getBytes(10,20)
 c.abort();await assert.rejects(first,/Cancelled/)
 release.resolve()
 assert.deepEqual(new Uint8Array((await second).data),bytes.slice(10,30))
 assert.equal(f.calls,1);s.close()
})
