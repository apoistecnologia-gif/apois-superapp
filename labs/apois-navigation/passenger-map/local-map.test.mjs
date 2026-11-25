import test from 'node:test'
import assert from 'node:assert/strict'
import {localPackReader,localTileSource,verifyLocalPack} from './local-map.mjs'
import {createHash} from 'node:crypto'
const sha=x=>createHash('sha256').update(x).digest('hex')
test('strict local reader blocks remote, path traversal and oversized bytes',async()=>{
 assert.throws(()=>localPackReader({base:'https://outside.example/',origin:'https://localhost'}))
 const read=localPackReader({base:'/maps/',origin:'https://localhost',fetcher:async(url,opts)=>{assert.equal(url,'https://localhost/maps/vale.pmtiles');assert.equal(opts.redirect,'error');return new Response(new Uint8Array([1,2,3]))}})
 await assert.rejects(()=>read('../other',10))
 await assert.rejects(()=>read('vale.pmtiles',2))
 assert.equal((await read('vale.pmtiles',3)).byteLength,3)
})
test('archive ranges are bounded and do not expose mutable shared bytes',async()=>{
 const bytes=new Uint8Array([1,2,3,4]).buffer,source=localTileSource(bytes,'x')
 const {data}=await source.getBytes(1,10);assert.deepEqual([...new Uint8Array(data)],[2,3,4]);new Uint8Array(data)[0]=9;assert.equal(new Uint8Array(bytes)[1],2)
 await assert.rejects(()=>source.getBytes(-1,2));await assert.rejects(()=>source.getBytes(4,1))
})
test('manifest is bound to trusted ID and every byte is checked',async()=>{
 const names=['vale.pmtiles','style.json','OSM-NOTICE.txt','LICENSE-Open-Sans.txt','glyphs/Open Sans Regular/0-255.pbf']
 const data=new TextEncoder().encode('synthetic')
 const files=names.map(path=>({path,bytes:data.byteLength,sha256:sha(data)}))
 const pack_id=sha(files.map(f=>f.sha256).join('')),manifest={schema:1,region:'vale-pe-ba',extract_sha256:'a'.repeat(64),pack_id,files}
 const read=async path=>path==='manifest.json'?new TextEncoder().encode(JSON.stringify(manifest)).buffer:data.slice().buffer
 assert.equal((await verifyLocalPack({read,expectedPackId:pack_id})).files.size,5)
 await assert.rejects(()=>verifyLocalPack({read,expectedPackId:'b'.repeat(64)}))
 await assert.rejects(()=>verifyLocalPack({read:async p=>p==='style.json'?new Uint8Array(data.length).buffer:read(p),expectedPackId:pack_id}))
})
