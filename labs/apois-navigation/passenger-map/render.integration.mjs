import {chromium} from 'playwright-core'
import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import {readFileSync,statSync} from 'node:fs'
import {resolve,extname} from 'node:path'
const dir=resolve(process.argv[2])
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.pbf':'application/octet-stream','.pmtiles':'application/octet-stream','.txt':'text/plain'}
const server=createServer((req,res)=>{
 try{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname)
  const file=resolve(dir,'.'+(path==='/'?'/index.html':path))
  if(!file.startsWith(dir+'/')||!statSync(file).isFile())throw Error('missing')
  const data=readFileSync(file);res.writeHead(200,{'Content-Type':mime[extname(file)]??'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store'});res.end(data)
 }catch{res.writeHead(404);res.end()}
})
await new Promise(r=>server.listen(0,'127.0.0.1',r))
const origin='http://127.0.0.1:'+server.address().port
let browser
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']})
 const page=await browser.newPage({viewport:{width:420,height:740}})
 const external=[]
 await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/'))return route.continue();external.push(url);return route.abort()})
 page.on('pageerror',e=>console.log('browser error',String(e)))
 await page.goto(origin)
 await page.waitForFunction(()=>typeof window.startMap==='function')
 await page.evaluate(()=>window.startMap())
 await page.waitForFunction(()=>window.apoisMap?.map.loaded()&&window.apoisMap.map.queryRenderedFeatures({layers:['roads','road-label']}).length>0,{},{timeout:20000})
 const stats=await page.evaluate(()=>{
  const {map,metrics}=window.apoisMap
  return {roads:map.queryRenderedFeatures({layers:['roads']}).length,labels:map.queryRenderedFeatures({layers:['road-label','place-label']}).length,attribution:document.querySelector('.maplibregl-ctrl-attrib')?.textContent,...metrics()}
 })
 assert.ok(stats.roads>0&&stats.tiles>0&&stats.glyphs>0&&stats.labels>0,JSON.stringify(stats))
 assert.match(stats.attribution,/OpenStreetMap contributors/)
 assert.equal(external.length,0)
 await page.evaluate(()=>window.apoisMap.dispose())
 assert.equal(await page.locator('.maplibregl-canvas').count(),0)
 console.log('APOIS_LOCAL_WEB_MAP_RENDER_OK',JSON.stringify(stats))
}finally{await browser?.close();await new Promise(r=>server.close(r))}
