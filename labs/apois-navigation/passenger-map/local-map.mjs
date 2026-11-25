// WebView candidate: only trusted bundled regional data, no public map server.
// Dependencies are injected so the operational build is unchanged.
const MAX_PACK=16*1024*1024,MAX_MANIFEST=32768
const hash=/^[a-f0-9]{64}$/
const enc=new TextEncoder(),dec=new TextDecoder()
const hex=bytes=>Array.from(new Uint8Array(bytes),v=>v.toString(16).padStart(2,'0')).join('')
const sha=async bytes=>hex(await crypto.subtle.digest('SHA-256',bytes))
const validPath=p=>['vale.pmtiles','style.json','OSM-NOTICE.txt','LICENSE-Open-Sans.txt'].includes(p)||/^glyphs\/Open Sans Regular\/\d+-\d+\.pbf$/.test(p)
function alive(signal){if(signal?.aborted)throw new DOMException('Cancelled','AbortError')}
export function localPackReader({base,origin,fetcher=fetch}){
 const root=new URL(base,origin)
 if(root.origin!==new URL(origin).origin||!root.pathname.endsWith('/')||root.search||root.hash||root.username||root.password||!['http:','https:'].includes(root.protocol))throw Error('Invalid local pack base')
 return async(path,max,signal)=>{
  if(path!=='manifest.json'&&!validPath(path))throw Error('Invalid local asset path')
  if(!Number.isSafeInteger(max)||max<1||max>MAX_PACK)throw Error('Invalid asset size')
  alive(signal)
  const url=new URL(path.split('/').map(encodeURIComponent).join('/'),root)
  if(url.origin!==root.origin||!url.pathname.startsWith(root.pathname))throw Error('Outside local pack')
  const response=await fetcher(url.href,{redirect:'error',signal,credentials:'omit',cache:'no-store'})
  if(!response.ok||!response.body||Number(response.headers.get('content-length'))>max){await response.body?.cancel();throw Error('Local asset unavailable')}
  const reader=response.body.getReader(),chunks=[];let n=0
  try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.byteLength;if(n>max){await reader.cancel();throw Error('Asset size exceeded')}chunks.push(value)}}finally{reader.releaseLock()}
  alive(signal)
  const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}return bytes.buffer
 }
}
export async function verifyLocalPack({read,expectedPackId,expectedManifestSha256,signal}){
 if(!hash.test(expectedPackId))throw Error('Trusted pack ID required')
 const raw=await read('manifest.json',MAX_MANIFEST,signal)
 if(raw.byteLength>MAX_MANIFEST)throw Error('Manifest too large')
 if(expectedManifestSha256!==undefined&&(!hash.test(expectedManifestSha256)||await sha(raw)!==expectedManifestSha256))throw Error('Manifest identity mismatch')
 const m=JSON.parse(dec.decode(raw))
 if(m.schema!==1||m.region!=='vale-pe-ba'||m.pack_id!==expectedPackId||!hash.test(m.extract_sha256)||!Array.isArray(m.files)||m.files.length>36)throw Error('Invalid pack manifest')
 const entries=m.files,paths=new Set();let total=0
 for(const f of entries){
  if(!validPath(f.path)||paths.has(f.path)||!hash.test(f.sha256)||!Number.isSafeInteger(f.bytes)||f.bytes<1)throw Error('Invalid asset entry')
  paths.add(f.path);total+=f.bytes
 }
 if(total>MAX_PACK||!['vale.pmtiles','style.json','OSM-NOTICE.txt','LICENSE-Open-Sans.txt'].every(p=>paths.has(p))||![...paths].some(p=>p.startsWith('glyphs/')))throw Error('Incomplete pack')
 if(await sha(enc.encode(entries.map(f=>f.sha256).join('')))!==expectedPackId)throw Error('Invalid pack identity')
 const files=new Map()
 for(const f of entries){alive(signal);const data=await read(f.path,f.bytes,signal);if(data.byteLength!==f.bytes||await sha(data)!==f.sha256)throw Error('Asset integrity failure');files.set(f.path,data)}
 alive(signal)
 return {files,extractHash:m.extract_sha256}
}
export function localTileSource(bytes,key){
 return {getKey:()=>key,async getBytes(offset,length,signal){
  alive(signal)
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<1||offset>=bytes.byteLength||!Number.isSafeInteger(offset+length))throw Error('Invalid PMTiles range')
  return {data:bytes.slice(offset,Math.min(offset+length,bytes.byteLength))}
 }}
}
export async function mountLocalPassengerMap(root,{maplibre,PMTiles,read,expectedPackId,expectedManifestSha256,signal,loadTimeout=15000}){
 if(!root||!maplibre?.Map||typeof maplibre.addProtocol!=='function'||typeof maplibre.removeProtocol!=='function'||typeof PMTiles!=='function')throw Error('Missing map dependency')
 const {files,extractHash}=await verifyLocalPack({read,expectedPackId,expectedManifestSha256,signal})
 const archive=new PMTiles(localTileSource(files.get('vale.pmtiles'),expectedPackId))
 const header=await archive.getHeader()
 if(header.specVersion!==3||header.tileType!==1||header.minZoom!==8||header.maxZoom!==15)throw Error('Unexpected regional tile format')
 const style=JSON.parse(dec.decode(files.get('style.json')))
 if(style.version!==8||Object.keys(style.sources??{}).join(',')!=='regional'||style.sources.regional.type!=='vector'||style.sources.regional.url!=='pmtiles://asset://apois-regional/vale.pmtiles'||style.glyphs!=='asset://apois-regional/glyphs/{fontstack}/{range}.pbf'||style.sprite||style.imports||style.sources.regional.tiles)throw Error('Unsupported local style')
 const scheme='apoispack'+crypto.randomUUID().replaceAll('-',''),prefix=scheme+'://regional/'
 delete style.sources.regional.url
 style.sources.regional.tiles=[prefix+'tile/{z}/{x}/{y}.pbf']
 style.sources.regional.attribution='© OpenStreetMap contributors'
 style.glyphs=prefix+'glyphs/{fontstack}/{range}.pbf'
 let disposed=false,map=null,registered=false,tiles=0,glyphs=0
 const dispose=()=>{if(disposed)return;disposed=true;signal?.removeEventListener('abort',dispose);try{map?.remove()}finally{if(registered)maplibre.removeProtocol(scheme);files.clear()}}
 try{
  alive(signal)
  maplibre.addProtocol(scheme,async(params,controller)=>{
   if(disposed||controller.signal.aborted||!params.url.startsWith(prefix))throw new DOMException('Cancelled','AbortError')
   const path=decodeURIComponent(params.url.slice(prefix.length))
   const match=/^tile\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(path)
   if(match){
    const [z,x,y]=match.slice(1).map(Number)
    if(z<8||z>15||x<0||x>=2**z||y<0||y>=2**z)throw Error('Tile outside pack')
    const tile=await archive.getZxy(z,x,y,controller.signal)
    if(disposed||controller.signal.aborted)throw new DOMException('Cancelled','AbortError')
    tiles++;return {data:tile?.data??new ArrayBuffer(0)}
   }
   if(/^glyphs\/Open Sans Regular\/\d+-\d+\.pbf$/.test(path)){
    const data=files.get(path);if(!data)throw Error('Glyph not present')
    glyphs++;return {data:data.slice(0)}
   }
   throw Error('Unexpected resource')
  });registered=true
  map=new maplibre.Map({container:root,style,center:[-40.504,-9.41],zoom:13,minZoom:8,maxZoom:18,maxBounds:[[-40.8,-9.65],[-40.2,-9.1]],renderWorldCopies:false,attributionControl:false,transformRequest:url=>{if(!url.startsWith(prefix))throw Error('Remote map resource blocked');return {url}}})
  map.addControl(new maplibre.AttributionControl({compact:false,customAttribution:'© OpenStreetMap contributors'}))
  signal?.addEventListener('abort',dispose,{once:true})
  await new Promise((resolve,reject)=>{
   let timer;const clean=()=>{clearTimeout(timer);map.off('load',loaded);map.off('error',failed);signal?.removeEventListener('abort',aborted)}
   const loaded=()=>{clean();resolve()}
   const failed=e=>{clean();reject(e?.error??Error('Map load failed'))}
   const aborted=()=>{clean();reject(new DOMException('Cancelled','AbortError'))}
   timer=setTimeout(()=>{clean();reject(Error('Local map load timeout'))},loadTimeout)
   map.on('load',loaded);map.on('error',failed);signal?.addEventListener('abort',aborted,{once:true})
   if(signal?.aborted)aborted()
  })
  alive(signal)
  return {map,dispose,extractHash,metrics:()=>({tiles,glyphs})}
 }catch(e){dispose();throw e}
}
