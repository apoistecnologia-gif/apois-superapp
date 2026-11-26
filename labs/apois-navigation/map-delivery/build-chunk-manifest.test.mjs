import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,writeFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createHash} from 'node:crypto'
import {buildChunkManifest} from './build-chunk-manifest.mjs'
import {verifiedManifest} from './verified-range-source.mjs'
test('streamed manifest is deterministic, pinned to full archive and final short chunk',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'apois-chunks-'))
 try{
  const path=join(dir,'test.pmtiles'),bytes=Buffer.alloc(65536+321,17),sha=b=>createHash('sha256').update(b).digest('hex')
  await writeFile(path,bytes)
  const opts={expectedSha256:sha(bytes),expectedBytes:bytes.length,chunkBytes:65536}
  const a=await buildChunkManifest(path,opts),b=await buildChunkManifest(path,opts)
  assert.deepEqual(a,b)
  const m=await verifiedManifest(a.raw,a.sha256)
  assert.deepEqual(m.chunks,[sha(bytes.subarray(0,65536)),sha(bytes.subarray(65536))])
  await assert.rejects(buildChunkManifest(path,{...opts,expectedBytes:bytes.length+1}),/size mismatch/)
  bytes[0]=18;await writeFile(path,bytes)
  await assert.rejects(buildChunkManifest(path,opts),/integrity mismatch/)
 }finally{await rm(dir,{recursive:true,force:true})}
})
