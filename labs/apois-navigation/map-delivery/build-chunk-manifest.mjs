// Release preparation only: bounded memory; independently expected whole-file
// hash and length are mandatory. This does not sign or publish any artifact.
import {open,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const hex=/^[a-f0-9]{64}$/
const hash=b=>createHash('sha256').update(b).digest('hex')
export async function buildChunkManifest(path,{expectedSha256,expectedBytes,chunkBytes=262144}={}){
 if(typeof expectedSha256!=='string'||!hex.test(expectedSha256)||!Number.isSafeInteger(expectedBytes)||expectedBytes<127||!Number.isSafeInteger(chunkBytes)||chunkBytes<65536||chunkBytes>2097152||Math.ceil(expectedBytes/chunkBytes)>30000)throw Error('Trusted archive metadata required')
 const fd=await open(path,'r')
 try{
  const info=await fd.stat()
  if(!info.isFile()||info.size!==expectedBytes)throw Error('Archive size mismatch')
  const full=createHash('sha256'),chunks=[]
  const buf=Buffer.alloc(chunkBytes)
  for(let offset=0;offset<expectedBytes;offset+=chunkBytes){
   const size=Math.min(chunkBytes,expectedBytes-offset)
   let pos=0
   while(pos<size){
    const {bytesRead}=await fd.read(buf,pos,size-pos,offset+pos)
    if(bytesRead===0)throw Error('Archive truncated')
    pos+=bytesRead
   }
   const data=buf.subarray(0,size);full.update(data);chunks.push(hash(data))
  }
  const after=await fd.stat()
  if(after.size!==info.size||after.mtimeMs!==info.mtimeMs||full.digest('hex')!==expectedSha256)throw Error('Archive integrity mismatch')
  const raw=Buffer.from(JSON.stringify({format:'APOIS-PMTILES-CHUNKS-v1',archiveSha256:expectedSha256,bytes:expectedBytes,chunkBytes,chunks})+'\n')
  if(raw.length>2*1024*1024)throw Error('Manifest exceeds client limit')
  return {raw,sha256:hash(raw)}
 }finally{await fd.close()}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [archive,out,digest,size]=process.argv.slice(2)
 if(!archive||!out||!digest||!size||process.argv.length!==6)throw Error('Usage: node build-chunk-manifest.mjs ARCHIVE OUTPUT EXPECTED_SHA256 EXPECTED_BYTES')
 const result=await buildChunkManifest(archive,{expectedSha256:digest,expectedBytes:Number(size)})
 await writeFile(out,result.raw,{flag:'wx'})
 console.log(JSON.stringify({manifestSha256:result.sha256,manifestBytes:result.raw.length,archiveSha256:digest,archiveBytes:Number(size),published:false}))
}
