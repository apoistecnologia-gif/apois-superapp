import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const root=resolve('.work/partner-entregador'),out=resolve('qa-browser/parceiro/courier-components');
mkdirSync(out,{recursive:true});
const route=readFileSync(resolve(root,'src/routes/courier.tsx'),'utf8');
const premium=readFileSync(resolve(root,'src/components/CourierPremiumViews.tsx'),'utf8');
const maps=readFileSync(resolve(root,'src/components/CourierRouteMap.tsx'),'utf8');
const a=premium.indexOf('export function CourierStatusCard('),b=premium.indexOf('export function CourierWaitingSheet(',a);
assert.ok(a>=0&&b>a);
const status=premium.slice(a,b);
const c=maps.indexOf('function RecenterControl('),d=maps.indexOf('export function CourierLiveMap(',c);
assert.ok(c>=0&&d>c);
const recenter=maps.slice(c,d);
const home=route.indexOf('const online = Boolean(availability?.is_online)');
const h=route.indexOf('<header',home),end=route.indexOf('</header>',h);
assert.ok(home>=0&&h>home&&end>h);
const header=route.slice(h,end+9);
assert.ok(header.includes('src={APOIS_PARTNER_LOGO_DATA_URL}')&&!header.includes('alt="APOIS ENTREGA"'));
const gate=route.match(/\{([^{}\n]+)\s*\?\s*\(\s*<div data-apois-courier-inline-status/);
assert.ok(gate,'actual availability gate absent');
const visible=new Function('online','activeJob','completedJob','return ('+gate[1]+')');
for(const online of [false,true]){
 assert.equal(visible(online,null,null),true);
 assert.equal(visible(online,{id:'synthetic'},null),false);
 assert.equal(visible(online,null,{id:'synthetic'}),false);
}
const logo=readFileSync(resolve(root,'src/assets/apoisPartnerLogoData.ts'),'utf8');
const cssRoot=resolve('superapp/partner-shell/dist/modules/entregador/assets');
const css=readdirSync(cssRoot).filter(n=>n.endsWith('.css')).map(n=>readFileSync(resolve(cssRoot,n),'utf8')).join('\n');
writeFileSync(resolve(out,'fixture.css'),css);
const entry=resolve(root,'apois-home-regression-fixture.tsx');
writeFileSync(entry,[
'import React,{useState} from "react";',
'import {createRoot} from "react-dom/client";',
'import {Power,Radio,Loader2,Crosshair,UserRound} from "lucide-react";',
logo,
'const useMap=()=>({panTo:()=>{document.body.dataset.recenter="yes"},setZoom:()=>{}});',
'type LatLng={lat:number;lng:number};',
status,recenter,
'function App(){const [online,setOnline]=useState(false);const [busy,setBusy]=useState(false);const activeJob=null,completedJob=null;const setProfileOpen=()=>{};return <div>',
'<p>Fixture de componentes reais — dados sintéticos, sem login/backend/Maps</p>',
header,
'<main><div style={{position:"relative",height:100,background:"#EDEAE4"}}><RecenterControl position={{lat:0,lng:0}}/></div>',
'<div data-apois-courier-inline-status><CourierStatusCard online={online} busy={busy} activeJob={activeJob} onToggle={()=>setOnline(!online)}/></div>',
'<button id="qa-busy" onClick={()=>setBusy(!busy)}>QA ocupado</button></main></div>}',
'createRoot(document.getElementById("root")!).render(<App/>);',
].join('\n'));
const build=spawnSync('bun',['build',entry,'--target','browser','--outdir',out],{cwd:root,encoding:'utf8'});
assert.equal(build.status,0,build.stderr);
writeFileSync(resolve(out,'index.html'),'<!doctype html><html class="apois-system-theme"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="fixture.css"><div id="root"></div><script type="module" src="apois-home-regression-fixture.js"></script></html>');
const server=createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!['index.html','fixture.css','apois-home-regression-fixture.js'].includes(name)){res.writeHead(404).end();return;}res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(readFileSync(resolve(out,name)));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const require=createRequire(resolve(process.env.APOIS_PLAYWRIGHT_ROOT,'package.json'));
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const width of [360,390,1280]){
  const context=await browser.newContext({viewport:{width,height:800},serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin,{waitUntil:'networkidle'});
  const toggle=page.locator('[data-apois-courier-availability-toggle]');
  await toggle.waitFor({state:'visible'});
  assert.equal(await toggle.getAttribute('aria-label'),'Ficar online');
  assert.equal(await toggle.isEnabled(),true);
  const brand=await page.locator('header img').evaluate(img=>({src:img.src,content:getComputedStyle(img).content,width:img.getBoundingClientRect().width}));
  assert.ok(brand.src.startsWith('data:image/png;base64,'));
  assert.ok(['normal','none'].includes(brand.content)&&brand.width>0);
  assert.equal(await page.locator('[data-apois-courier-recenter]').evaluate(e=>getComputedStyle(e).color),'rgb(17, 24, 39)');
  await page.screenshot({path:resolve(out,'offline-'+width+'.png'),fullPage:true});
  await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  await page.screenshot({path:resolve(out,'online-'+width+'.png'),fullPage:true});
  await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  await page.locator('#qa-busy').click();assert.equal(await toggle.isDisabled(),true);
  await page.locator('[data-apois-courier-recenter]').click();assert.equal(await page.locator('body').getAttribute('data-recenter'),'yes');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[]);
  results.push({width,passed:true,scope:'Actual assembled JSX fragments and production CSS; synthetic props; no authenticated/backend/native E2E'});
  await context.close();
 }
}finally{
 writeFileSync(resolve(out,'report.json'),JSON.stringify({results},null,2));
 await browser.close();server.close();
}
console.log('[OK] Courier actual presentation fragments: 3 widths, offline/online/busy, official brand, recenter callback; active/completed gate truth table');
