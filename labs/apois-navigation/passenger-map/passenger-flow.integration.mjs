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
const origin='http://127.0.0.1:'+server.address().port,id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
let browser,selection=null,ride=null,creates=0,confirms=0,quotes=0,catalogReads=0,terminal=false
const selectionPoints={origin:{lat:-9.41,lng:-40.504,label:'Embarque sintético'},destination:{lat:-9.414,lng:-40.51,label:'Destino sintético'}}
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_BIN,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']})
 const page=await browser.newPage({viewport:{width:420,height:740}})
 const external=[]
 await page.route('**/*',route=>{const url=route.request().url();if(url.startsWith(origin+'/'))return route.continue();external.push(url);return route.abort()})
 page.on('pageerror',e=>console.log('browser error',String(e)))
 await page.exposeFunction('labRpc',async(name,opts)=>{
  assert.equal(opts.headers.Authorization,'Bearer synthetic-local-browser-token')
  const b=opts.body
  if(b.action==='apois_navigation_catalog'){
   assert.equal(name,'apois-navigation-control');assert.deepEqual(b,{action:'apois_navigation_catalog'});catalogReads++
   const hash='c50dd021ab11518b230c191bc9fa85f683c9b82810f605476532c16172f55238',common={active:true,version:1,extract_sha256:hash}
   return {data:{ok:true,catalog:{source:'OSM_PBF',version:1,extract_sha256:hash,rows:[{...common,id:id(792),...selectionPoints.origin},{...common,id:id(793),...selectionPoints.destination}]}}}
  }
  if(b.action==='apois_navigation_active'){assert.equal(name,'apois-navigation-control');return {data:{verified:true,ride:terminal?null:ride}}}
  if(b.action==='apois_navigation_confirm'){
   assert.equal(name,'apois-navigation-control');assert.deepEqual(b.pickup,{id:id(792),version:1});assert.deepEqual(b.destination,{id:id(793),version:1})
   confirms++;selection={selectionId:id(794),requestKey:b.requestKey,expiresAt:new Date(Date.now()+120000).toISOString(),...selectionPoints}
   return {data:{ok:true,...selection}}
  }
  assert.ok(selection);assert.equal(b.selectionId,selection.selectionId);assert.equal(b.requestKey,selection.requestKey)
  if(b.action==='apois_navigation_quote'){assert.equal(name,'request-ride');quotes++;return {data:{ok:true,estimated_price:12.34,fare_amount_cents:1234,distance_km:2,duration_min:7,expiresAt:selection.expiresAt}}}
  if(b.action==='apois_navigation_create'){
   assert.equal(name,'request-ride');assert.equal(b.expected_price_cents,1234);creates++;ride={rideId:id(795),status:'procurar_motorista'}
   throw Error('synthetic response lost after commit')
  }
  if(b.action==='apois_navigation_recover'){assert.equal(name,'apois-navigation-control');return {data:{ok:true,selectionId:selection.selectionId,requestKey:selection.requestKey,state:'ride',ride:terminal?{...ride,status:'finalizada'}:ride}}}
  throw Error('unexpected action '+b.action)
 })
 await page.goto(origin)
 await page.waitForFunction(()=>typeof window.startHost==='function')
 assert.equal((await page.evaluate(()=>window.startHost(true))).state,'ready')
 assert.equal(catalogReads,1)
 // Real map click only suggests a point. No confirmation or creation.
 const point=await page.evaluate(()=>{const p=window.apoisMap.map.project([-40.504,-9.41]);const r=document.getElementById('map').getBoundingClientRect();return {x:p.x+r.left,y:p.y+r.top}})
 await page.mouse.click(point.x,point.y)
 await page.getByRole('button',{name:'Usar ponto sugerido',exact:true}).click()
 assert.equal(confirms,0);assert.equal(creates,0)
 await page.getByRole('button',{name:'Escolher destino',exact:true}).click()
 await page.getByRole('searchbox').fill('Destino sintético')
 await page.getByRole('button',{name:'Destino sintético',exact:true}).click()
 await page.getByRole('button',{name:'Confirmar embarque e destino',exact:true}).click()
 await page.getByText('Seleção confirmada. Nenhuma corrida foi criada.',{exact:true}).waitFor()
 assert.equal(confirms,1);assert.equal(creates,0)
 await page.getByRole('button',{name:'Revisar valor',exact:true}).click()
 await page.getByText(/Valor confirmado pelo servidor/).waitFor()
 assert.equal(quotes,1);assert.equal(creates,0)
 await page.getByRole('button',{name:'Confirmar corrida',exact:true}).click()
 await page.getByText(/A solicitação precisa ser recuperada/).waitFor()
 assert.equal(creates,1)
 const before=await page.evaluate(()=>window.readJournal());assert.equal(before.requestKey,selection.requestKey)
 assert.equal(await page.getByRole('button',{name:'Voltar ao fluxo atual',exact:true}).count(),0)
 // Actual browser reload; no map mount or selection allowed during recovery.
 await page.reload()
 await page.waitForFunction(()=>typeof window.startHost==='function')
 assert.equal((await page.evaluate(()=>window.startHost(false))).state,'recovery')
 assert.deepEqual(await page.evaluate(()=>window.readJournal()),before)
 assert.equal(await page.locator('.maplibregl-canvas').count(),0)
 assert.equal(creates,1)
 await page.getByRole('button',{name:'Verificar solicitação existente',exact:true}).click()
 await page.getByRole('button',{name:'Acompanhar corrida',exact:true}).click()
 await page.waitForFunction(()=>window.trackedRide==='00000000-0000-4000-8000-000000000795')
 terminal=true
 await page.getByRole('button',{name:'Verificar solicitação existente',exact:true}).click()
 await page.getByRole('button',{name:'Voltar ao fluxo atual',exact:true}).click()
 await page.waitForFunction(()=>window.returned===1)
 assert.equal(await page.evaluate(()=>window.readJournal()),null)
 assert.equal(creates,1);assert.equal(external.length,0);assert.equal(catalogReads,1)
 console.log('APOIS_LOCAL_MAP_PASSENGER_BROWSER_FLOW_OK',JSON.stringify({realMap:true,realDom:true,indexedDB:true,webLocks:true,explicitConfirm:true,creates,confirms,quotes,reloadRecovery:true,noMapRecovery:true,terminalReleased:true,catalogReads,externalRequests:external.length}))
}finally{await browser?.close();await new Promise(r=>server.close(r))}
