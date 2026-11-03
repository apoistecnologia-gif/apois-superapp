import assert from "node:assert/strict";
import {createServer} from "node:http";
import {resolve,sep,extname} from "node:path";
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from "node:fs";
import {createRequire} from "node:module";
// APOIS_ADMIN_PREVIEW_RENDER_QA_V2 — anonymous/static, never uses production credentials.
const root=resolve(".work/partner-motorista/dist/admin-preview"),out=resolve("qa-browser/admin-corridas");
const require=createRequire(resolve(process.env.APOIS_PLAYWRIGHT_ROOT,"package.json"));
const {chromium}=require("playwright");
assert.ok(existsSync(resolve(root,"index.html")),"Compiled Admin Corridas preview absent");
mkdirSync(out,{recursive:true});
const mime={".html":"text/html",".js":"text/javascript",".css":"text/css",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".woff2":"font/woff2"};
const server=createServer((req,res)=>{
 const pathname=new URL(req.url,"http://localhost").pathname;
 const requested=resolve(root,"."+decodeURIComponent(pathname));
 if(requested!==root&&!requested.startsWith(root+sep)){res.writeHead(403).end();return;}
 const target=existsSync(requested)&&statSync(requested).isFile()?requested:pathname.startsWith("/admin/")?resolve(root,"index.html"):requested;
 if(!existsSync(target)||!statSync(target).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{"Content-Type":mime[extname(target)]||"application/octet-stream"});
 res.end(readFileSync(target));
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const base="http://127.0.0.1:"+server.address().port,results=[];
let browser,fail=false;
try{
 browser=await chromium.launch({headless:true});
 for(const [width,height] of [[320,700],[360,800],[390,844],[1280,900]]){
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:"block"});
  await context.route("**/*",route=>{
   if(new URL(route.request().url()).origin===base)return route.continue();
   return route.abort("blockedbyclient");
  });
  const page=await context.newPage(),errors=[],missing=[];
  page.on("pageerror",err=>errors.push(String(err.message).slice(0,180)));
  page.on("response",res=>{if(res.url().startsWith(base)&&res.status()>=400)missing.push(new URL(res.url()).pathname)});
  const rec={width,height};
  try{
   await page.goto(base+"/admin/login",{waitUntil:"networkidle",timeout:30000});
   await page.waitForTimeout(1200);
   const panel=page.locator('[data-apois-admin-desktop-login="2026"]');
   await panel.waitFor({state:"visible"});
   assert.ok(await page.getByRole("heading",{name:"Entrar no painel"}).isVisible());
   const logo=page.getByAltText("Logomarca APOIS").first();
   assert.ok(await logo.isVisible(),"Official APOIS logo not visible");
   const field=page.locator('input[name="email"]');
   await field.fill("visual-qa@example.invalid");
   const text=await field.evaluate(el=>{
    const s=getComputedStyle(el);
    return {color:s.color,fill:s.webkitTextFillColor,bg:s.backgroundColor,value:el.value,
       width:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.equal(text.value,"visual-qa@example.invalid");
   assert.ok(text.color!=="rgb(255, 255, 255)" && text.fill!=="rgb(255, 255, 255)",
    "White input text on Admin login white surface");
   assert.ok(text.width<=text.viewport+2,"Admin login overflows horizontally");
   assert.equal(errors.length,0,"Admin runtime errors: "+errors.join("; "));
   assert.equal(missing.length,0,"Admin missing assets: "+missing.join("; "));
   rec.color=text.color;rec.widthOk=true;rec.logoOk=true;rec.jsErrors=0;rec.missingAssets=0;rec.passed=true;
   await page.screenshot({path:resolve(out,"admin-corridas-login-"+width+".png"),fullPage:true});
   // Real client-side recovery navigation, with no emails, account mutations,
   // or calls to a production Auth service.
   await page.getByText("Esqueci minha senha",{exact:true}).click();
   await page.waitForURL(url=>url.pathname==="/admin/recuperar-senha",{timeout:8000});
   assert.ok(await page.getByRole("heading",{name:"Recuperar senha"}).isVisible(),
    "Admin password-recovery route did not render");
   const recoveryEmail=page.locator('input#recovery-email');
   await recoveryEmail.fill("visual-recovery-qa@example.invalid");
   const recoveryVisual=await recoveryEmail.evaluate(el=>{
    const style=getComputedStyle(el);
    return {value:el.value,color:style.color,fill:style.webkitTextFillColor,
      width:document.documentElement.scrollWidth,viewport:innerWidth};
   });
   assert.equal(recoveryVisual.value,"visual-recovery-qa@example.invalid");
   assert.notEqual(recoveryVisual.color,"rgb(255, 255, 255)",
    "Admin recovery text invisible on white input");
   assert.notEqual(recoveryVisual.fill,"rgb(255, 255, 255)",
    "Admin recovery WebKit text fill invisible");
   assert.ok(recoveryVisual.width<=recoveryVisual.viewport+2,
    "Admin recovery layout overflows horizontally");
   assert.ok(await page.getByRole("button",{name:"Enviar link de recuperação"}).isVisible());
   assert.equal(errors.length,0,"Admin recovery runtime error");
   assert.equal(missing.length,0,"Admin recovery asset missing");
   await page.screenshot({path:resolve(out,"admin-corridas-recovery-"+width+".png"),fullPage:true});
   await page.getByText("Voltar ao login",{exact:true}).click();
   await page.waitForURL(url=>url.pathname==="/admin/login",{timeout:8000});
   assert.ok(await page.getByRole("heading",{name:"Entrar no painel"}).isVisible(),
    "Admin recovery return to login failed");
   rec.recoveryRoute=true;rec.recoveryBackToLogin=true;rec.recoveryNoSubmission=true;
  }catch(err){rec.error=String(err.message).slice(0,330);rec.passed=false;fail=true}
  results.push(rec);
  await context.close();
 }
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
 writeFileSync(resolve(out,"report.json"),JSON.stringify({scope:"Admin Corridas anonymous login + password recovery navigation; no email submission or authenticated operations",results},null,2));
}
for(const x of results)console.log((x.passed?"[OK] ":"[FAIL] ")+"Admin Corridas login "+x.width+"px "+(x.error||"professional layout, logo, input contrast, assets"));
if(fail)process.exitCode=1;
