import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {createServer as http} from 'node:http'
import {createServer as https} from 'node:https'
import {createHash,X509Certificate} from 'node:crypto'
import {readFileSync,writeFileSync,statSync,createReadStream,mkdirSync,cpSync} from 'node:fs'
import {resolve,extname,join} from 'node:path'
import {execFileSync} from 'node:child_process'
import {buildChunkManifest} from './build-chunk-manifest.mjs'
const pack=resolve(process.argv[2]),cert=readFileSync(process.argv[3]),key=readFileSync(process.argv[4]),site=resolve('site')
const sha=b=>createHash('sha256').update(b).digest('hex')
const manifest=readFileSync(join(pack,'manifest.json'))
assert.equal(sha(manifest),'367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb')
const m=JSON.parse(manifest)
for(const f of m.files){const b=readFileSync(join(pack,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256)}
const archive=join(pack,'vale.pmtiles'),size=statSync(archive).size,digest=sha(readFileSync(archive)),path='/maps/nordeste-'+digest+'.pmtiles',etag='"'+digest+'"'
const chunks=await buildChunkManifest(archive,{expectedSha256:digest,expectedBytes:size,chunkBytes:65536})
mkdirSync(site,{recursive:true})
cpSync(join(pack,'glyphs'),join(site,'glyphs'),{recursive:true})
writeFileSync('fixture-style.json',readFileSync(join(pack,'style.json')))
const pageServer=http((req,res)=>{
 try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
 const file=resolve(site,'.'+(path==='/'?'/index.html':path))
 if(!file.startsWith(site+'/')||!statSync(file).isFile())throw Error('missing')
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.pbf':'application/octet-stream'}
 const data=readFileSync(file);const headers={'Content-Type':mime[extname(file)]??'application/octet-stream','Content-Length':data.length};if(extname(file)==='.html')headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; img-src 'self' data: blob:; connect-src 'self' https://127.0.0.1:"+mapServer.address().port+"; object-src 'none'; base-uri 'none'";res.writeHead(200,headers);res.end(data)
 }catch{res.writeHead(404).end()}
})
const listen=s=>new Promise((r,j)=>{s.once('error',j);s.listen(0,'127.0.0.1',r)})
await listen(pageServer)
const origin='http://127.0.0.1:'+pageServer.address().port
let requests=0,preflights=0,bytes=0,unexpected=0
const mapServer=https({cert,key},(req,res)=>{
 const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Expose-Headers':'ETag, Content-Range, Content-Length, Cache-Control, Content-Encoding','Vary':'Origin'}
 if(req.url!==path||req.headers.origin!==origin||req.headers.authorization||req.headers.cookie){unexpected++;res.writeHead(400,cors).end();return}
 if(req.method==='OPTIONS'){preflights++;res.writeHead(204,{...cors,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Range, If-Range','Access-Control-Max-Age':'300'}).end();return}
 const match=/^bytes=(\d+)-(\d+)$/.exec(req.headers.range??'')
 if(req.method!=='GET'||!match||req.headers['if-range']!==etag){unexpected++;res.writeHead(400,cors).end();return}
 const start=Number(match[1]),end=Number(match[2])
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>=size){unexpected++;res.writeHead(416,cors).end();return}
 const n=end-start+1;requests++;bytes+=n
 res.writeHead(206,{...cors,'Content-Type':'application/octet-stream','Content-Length':n,'Content-Range':'bytes '+start+'-'+end+'/'+size,'ETag':etag,'Cache-Control':'public, max-age=31536000, immutable'})
 const stream=createReadStream(archive,{start,end});stream.on('error',()=>res.destroy());res.on('close',()=>stream.destroy());stream.pipe(res)
})
let browser
try{
 await listen(mapServer)
 const mapOrigin='https://127.0.0.1:'+mapServer.address().port
 writeFileSync('fixture-config.json',JSON.stringify({url:mapOrigin+path,authorizedOrigin:mapOrigin,etag,manifestText:chunks.raw.toString('utf8'),expectedManifestSha256:chunks.sha256}))
 execFileSync('./node_modules/.bin/esbuild',['range-browser-entry.mjs','--bundle','--format=esm','--outfile=site/bundle.js'],{stdio:'inherit'})
 writeFileSync(join(site,'index.html'),'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="./bundle.css"><style>body{margin:0}#map{width:320px;height:320px}</style><div id="map"></div><script type="module" src="./bundle.js"></script>')
 // Pin ONLY the ephemeral loopback server certificate public key in this CI
 // browser; no global ignoreHTTPSErrors or production certificate bypass.
 const pin=createHash('sha256').update(new X509Certificate(cert).publicKey.export({type:'spki',format:'der'})).digest('base64')
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-certificate-errors-spki-list='+pin]})
 const page=await browser.newPage({viewport:{width:320,height:500}})
 const external=[],errors=[]
 // Observe actual Chromium traffic without Playwright interception (which can change CORS/cache behavior).
 page.on('request',r=>{const u=r.url();if(!u.startsWith(origin+'/')&&u!==mapOrigin+path&&!u.startsWith('blob:')&&!u.startsWith('data:'))external.push(u)})
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(origin);await page.locator('script[type=module]').waitFor({state:'attached'});assert.equal(await page.evaluate(()=>typeof window.startMap),'function')
 // Independent browser CORS check: require If-Range preflight and exposed response metadata.
 const probe=await page.evaluate(async({url,etag})=>{
  const r=await fetch(url,{headers:{Range:'bytes=0-126','If-Range':etag},credentials:'omit',redirect:'error'});
  return {status:r.status,etag:r.headers.get('ETag'),range:r.headers.get('Content-Range'),bytes:(await r.arrayBuffer()).byteLength}
 },{url:mapOrigin+path,etag})
 console.log('CORS_PROBE',JSON.stringify({probe,preflights,requests,bytes}))
 assert.deepEqual(probe,{status:206,etag,range:'bytes 0-126/'+size,bytes:127})
 assert.ok(preflights>0,'No actual CORS preflight received')
 const initialBytes=bytes,initialRequests=requests
 await page.evaluate(()=>window.startMap())
 // Poll from the Node test harness; waitForFunction evaluates a string inside
 // the page and conflicts with strict script-src. Do not relax the CSP.
 const deadline=Date.now()+25000
 let rendered=false
 while(Date.now()<deadline){
  rendered=await page.evaluate(()=>Boolean(window.lab?.map.loaded()&&window.lab.map.queryRenderedFeatures({layers:['road-label']}).length>0))
  if(rendered)break
  await new Promise(r=>setTimeout(r,150))
 }
 assert.ok(rendered,'Map did not render road labels before deadline')
 const stats=await page.evaluate(()=>({roads:window.lab.map.queryRenderedFeatures({layers:['roads']}).length,labels:window.lab.map.queryRenderedFeatures({layers:['road-label','place-label']}).length,attribution:document.querySelector('.maplibregl-ctrl-attrib')?.textContent,...window.lab.metrics()}))
 assert.ok(stats.roads>0&&stats.labels>0&&stats.tiles>0);assert.match(stats.attribution,/OpenStreetMap contributors/)
 console.log('MAP_RANGE_METRICS',JSON.stringify({archiveBytes:size,rangeBytes:bytes-initialBytes,requests:requests-initialRequests,preflights,unexpected,external,errors,...stats}))
 assert.equal(external.length,0);assert.equal(errors.length,0);assert.equal(unexpected,0);assert.ok(requests>initialRequests,'No map range fetched');assert.ok(bytes-initialBytes<size,'Initial viewport transferred at least one entire archive')
 await page.evaluate(()=>window.lab.dispose());assert.equal(await page.locator('.maplibregl-canvas').count(),0)
 console.log(JSON.stringify({fixture:'vale-pe-ba',archiveBytes:size,rangeBytes:bytes-initialBytes,requests:requests-initialRequests,preflights,chunkVerified:true,manifestSha256:chunks.sha256,...stats,limits:'Chromium cross-origin local fixture, certificate SPKI pinned only for test; no Android or production CDN claim'},null,2))
}finally{await browser?.close();for(const s of [pageServer,mapServer]){s.closeAllConnections();if(s.listening)await new Promise(r=>s.close(r))}}
