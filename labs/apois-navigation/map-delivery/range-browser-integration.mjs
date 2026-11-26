import assert from 'node:assert/strict'
import {chromium} from 'playwright-core'
import {createServer as http} from 'node:http'
import {createServer as https} from 'node:https'
import {createHash,X509Certificate} from 'node:crypto'
import {readFileSync,writeFileSync,statSync,createReadStream,mkdirSync,cpSync} from 'node:fs'
import {resolve,extname,join} from 'node:path'
import {execFileSync} from 'node:child_process'
const pack=resolve(process.argv[2]),cert=readFileSync(process.argv[3]),key=readFileSync(process.argv[4]),site=resolve('site')
const sha=b=>createHash('sha256').update(b).digest('hex')
const manifest=readFileSync(join(pack,'manifest.json'))
assert.equal(sha(manifest),'367c0104a8a5de7f11bdf2c965eb91a73e1cf21b5a3809f78f53e7170b7cdebb')
const m=JSON.parse(manifest)
for(const f of m.files){const b=readFileSync(join(pack,f.path));assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256)}
const archive=join(pack,'vale.pmtiles'),size=statSync(archive).size,digest=sha(readFileSync(archive)),path='/maps/nordeste-'+digest+'.pmtiles',etag='"'+digest+'"'
mkdirSync(site,{recursive:true})
cpSync(join(pack,'glyphs'),join(site,'glyphs'),{recursive:true})
writeFileSync('fixture-style.json',readFileSync(join(pack,'style.json')))
const pageServer=http((req,res)=>{
 try{
 const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
 const file=resolve(site,'.'+(path==='/'?'/index.html':path))
 if(!file.startsWith(site+'/')||!statSync(file).isFile())throw Error('missing')
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.pbf':'application/octet-stream'}
 const data=readFileSync(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Content-Length':data.length});res.end(data)
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
 writeFileSync('fixture-config.json',JSON.stringify({url:mapOrigin+path,authorizedOrigin:mapOrigin,sha256:digest,bytes:size,etag}))
 execFileSync('./node_modules/.bin/esbuild',['range-browser-entry.mjs','--bundle','--format=esm','--outfile=site/bundle.js'],{stdio:'inherit'})
 writeFileSync(join(site,'index.html'),'<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="./bundle.css"><style>body{margin:0}#map{width:320px;height:320px}</style><div id="map"></div><script type="module" src="./bundle.js"></script>')
 // Pin ONLY the ephemeral loopback server certificate public key in this CI
 // browser; no global ignoreHTTPSErrors or production certificate bypass.
 const pin=createHash('sha256').update(new X509Certificate(cert).publicKey.export({type:'spki',format:'der'})).digest('base64')
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--ignore-certificate-errors-spki-list='+pin]})
 const page=await browser.newPage({viewport:{width:320,height:500}})
 const external=[],errors=[]
 await page.route('**/*',r=>{const u=r.request().url();if(u.startsWith(origin+'/')||u===mapOrigin+path)return r.continue();external.push(u);return r.abort()})
 page.on('pageerror',e=>errors.push(String(e)))
 await page.goto(origin);await page.waitForFunction(()=>typeof window.startMap==='function');await page.evaluate(()=>window.startMap())
 await page.waitForFunction(()=>window.lab?.map.loaded()&&window.lab.map.queryRenderedFeatures({layers:['road-label']}).length>0,{},{timeout:25000})
 const stats=await page.evaluate(()=>({roads:window.lab.map.queryRenderedFeatures({layers:['roads']}).length,labels:window.lab.map.queryRenderedFeatures({layers:['road-label','place-label']}).length,attribution:document.querySelector('.maplibregl-ctrl-attrib')?.textContent,...window.lab.metrics()}))
 assert.ok(stats.roads>0&&stats.labels>0&&stats.tiles>0);assert.match(stats.attribution,/OpenStreetMap contributors/)
 assert.equal(external.length,0);assert.equal(errors.length,0);assert.equal(unexpected,0);assert.ok(preflights>0&&requests>0&&bytes<size)
 await page.evaluate(()=>window.lab.dispose());assert.equal(await page.locator('.maplibregl-canvas').count(),0)
 console.log(JSON.stringify({fixture:'vale-pe-ba',archiveBytes:size,rangeBytes:bytes,requests,preflights,...stats,limits:'Chromium cross-origin local fixture, certificate SPKI pinned only for test; no Android or production CDN claim'},null,2))
}finally{await browser?.close();for(const s of [pageServer,mapServer]){s.closeAllConnections();if(s.listening)await new Promise(r=>s.close(r))}}
