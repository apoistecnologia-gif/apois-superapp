/** APOIS_CLIENT_PUBLIC_BROWSER_QA_V1 — logged-out, offline screenshots only. */
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,existsSync,statSync,mkdirSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';

const root=resolve('superapp/shell/dist');
const output=resolve('qa-browser/cliente-corridas-approved');
mkdirSync(output,{recursive:true});
const require=createRequire(resolve(process.env.APOIS_PLAYWRIGHT_ROOT,'package.json'));
const {chromium}=require('playwright');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer((req,res)=>{
 let path;try{path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
 if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
 const file=existsSync(path)&&statSync(path).isDirectory()?resolve(path,'index.html'):path;
 if(!existsSync(file)||!statSync(file).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream'});res.end(readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of [[320,700],[360,740],[390,844]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',reducedMotion:'reduce'});
  const blocked=new Set();
  await context.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin===origin)return route.continue();
   blocked.add(url.hostname);return route.abort('blockedbyclient');
  });
  const page=await context.newPage();
  await page.goto(origin+'/index.html',{waitUntil:'load',timeout:30000});
  await page.locator('[data-apois-client-welcome-v1]').waitFor();
  const welcome=await page.evaluate(()=>({
   visibleButtons:[...document.querySelectorAll('main button')].filter(b=>b.getBoundingClientRect().width>0).length,
   enterRect:document.querySelector('#apois-corridas-welcome-enter')?.getBoundingClientRect().toJSON(),
   horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,
   label:document.querySelector('h1')?.textContent?.trim(),
  }));
  assert.equal(welcome.visibleButtons,1,'Only one CTA on welcome');
  assert.ok(welcome.enterRect?.height>=48&&welcome.enterRect.bottom<=height+5,'Welcome Entrar visible on '+width);
  assert.equal(welcome.horizontalOverflow,false,'Welcome horizontal overflow on '+width);
  assert.equal(welcome.label,'APOIS');
  await page.screenshot({path:resolve(output,'boas-vindas-'+width+'.png'),fullPage:true});
  await page.getByRole('button',{name:'Entrar na minha conta APOIS Corridas'}).click();
  await page.waitForURL('**/modules/corridas/index.html#/login',{timeout:18000});
  const login=page.locator('[data-apois-client-login-approved-v1]');
  await login.waitFor({state:'visible',timeout:20000});
  const email=page.locator('input#login-email');
  const password=page.locator('input#login-password');
  await email.waitFor({state:'visible',timeout:9000});
  await password.waitFor({state:'visible',timeout:9000});
  const display=await page.evaluate(()=>({
    h1:document.querySelector('[data-apois-client-login-title-v2]')?.textContent?.trim(),
    background:getComputedStyle(document.querySelector('[data-apois-client-login-approved-v1]')).backgroundColor,
    horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,
    passwordInputType:document.querySelector('#login-password')?.getAttribute('type'),
    google:!!document.querySelector('button[aria-label="Continuar com Google"]'),
    recovery:!!document.querySelector('a[href*="recuperar-senha"]'),
    registration:!!document.querySelector('a[href*="cadastro"]'),
  }));
  assert.equal(display.h1,'Entrar na sua conta');
  assert.equal(display.horizontalOverflow,false,'Login horizontal overflow on '+width);
  assert.equal(display.background,'rgb(255, 255, 255)','Login must be approved white background');
  assert.equal(display.passwordInputType,'password','Real password input required');
  assert.ok(display.google&&display.recovery&&display.registration,'Existing live controls missing');
  await page.screenshot({path:resolve(output,'login-'+width+'.png'),fullPage:true});
  console.log('[OK] Cliente Corridas approved UI '+width+'x'+height+': welcome -> live login; network blocked '+JSON.stringify([...blocked]));
  await context.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}