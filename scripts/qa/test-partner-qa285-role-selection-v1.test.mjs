/**
 * QA285: actual Partner shell button listeners in a DOM VM.
 * The courier lock previously sent BOTH CTAs to Entregador login, silently.
 * With a conflicting active role, manual buttons must explain the lock,
 * never open the wrong module. Internal Push/deeplink fail-closed stays intact.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,createContext,runInContext} from "node:vm";

function shellScenario(file){
 const html=readFileSync(file,"utf8");
 const inline=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(inline,"shell controller missing");
 const buttons=[
   {dataset:{module:"motorista"},listeners:[],addEventListener(name,fn){if(name==="click")this.listeners.push(fn);}},
   {dataset:{module:"entregador"},listeners:[],addEventListener(name,fn){if(name==="click")this.listeners.push(fn);}},
 ];
 const warning={hidden:true,focusCount:0,focus(){this.focusCount++}};
 const description={textContent:""};
 const open={textContent:"",onclick:null};
 const dismiss={onclick:null};
 const nodes={
  "apois-role-conflict":warning,
  "apois-role-conflict-text":description,
  "apois-role-conflict-open":open,
  "apois-role-conflict-dismiss":dismiss,
 };
 const store=new Map(), temp=new Map(), nav=[];
 const storage=(data)=>({
  getItem:k=>data.get(k)??null,
  setItem:(k,v)=>data.set(k,String(v)),
  removeItem:k=>data.delete(k)
 });
 const context=createContext({
  URL,URLSearchParams,console,JSON,
  localStorage:storage(store),sessionStorage:storage(temp),
  document:{
   querySelectorAll:()=>buttons,
   getElementById:(id)=>nodes[id]??null
  },
  window:{
   location:{
    origin:"https://localhost",
    assign:(url)=>nav.push({kind:"assign",url}),
    replace:(url)=>nav.push({kind:"replace",url}),
   },
   Capacitor:null
  }
 });
 new Script(inline[1],{filename:file}).runInContext(context,{timeout:1000});
 const evalJS=(script)=>runInContext(script,context,{timeout:1000});
 const click=(module)=>buttons.find(b=>b.dataset.module===module).listeners[0]();
 return {html,store,nav,warning,description,open,dismiss,click,evalJS};
}
function verify(file){
 const env=shellScenario(file);
 assert.ok(env.html.includes('data-module="motorista"'),"driver CTA absent");
 assert.ok(env.html.includes('data-module="entregador"'),"courier CTA absent");
 assert.ok(env.html.includes("APOIS_QA285_ROLE_SELECTION_GUARD"),"QA285 runtime marker missing");
 assert.ok(env.html.includes("role=\"alert\""),"accessible lock warning missing");
 env.click("motorista");
 assert.deepEqual(env.nav.pop(),{kind:"assign",url:"https://localhost/modules/motorista/index.html"});
 env.click("entregador");
 assert.deepEqual(env.nav.pop(),{kind:"assign",url:"https://localhost/modules/entregador/index.html#/courier"});
 assert.equal(env.nav.length,0);

 env.store.set("apois-parceiro:operational-role","entregador");
 env.click("motorista");
 assert.equal(env.nav.length,0,"blocked motor manual tap must NOT open courier login");
 assert.equal(env.warning.hidden,false);
 assert.ok(env.description.textContent.includes("Entregador"));
 assert.ok(env.description.textContent.includes("Motorista"));
 assert.ok(env.warning.focusCount>=1);
 assert.equal(env.open.textContent,"Abrir Entregador para ficar offline");
 env.open.onclick();
 assert.deepEqual(env.nav.pop(),{kind:"assign",url:"https://localhost/modules/entregador/index.html#/courier"});
 env.dismiss.onclick();
 assert.equal(env.warning.hidden,true);
 env.click("entregador");
 assert.deepEqual(env.nav.pop(),{kind:"assign",url:"https://localhost/modules/entregador/index.html#/courier"});

 env.store.set("apois-parceiro:operational-role","motorista");
 env.click("entregador");
 assert.equal(env.nav.length,0,"blocked courier manual tap must NOT open driver login");
 assert.ok(env.description.textContent.includes("Motorista"));
 assert.ok(env.description.textContent.includes("Entregador"));
 env.click("motorista");
 assert.deepEqual(env.nav.pop(),{kind:"assign",url:"https://localhost/modules/motorista/index.html#/motorista/app"});
 // Programmatic cross-role push still fail-closes to the role actually active.
 assert.equal(env.evalJS("relayPartnerPush({notificationType:'delivery_offer',orderId:'courier-1'})"),false);
 assert.deepEqual(env.nav.pop(),{kind:"replace",url:"https://localhost/modules/motorista/index.html#/motorista/app"});
 env.store.set("apois-parceiro:operational-role","entregador");
 assert.equal(env.evalJS("relayPartnerPush({notificationType:'driver_ride',rideId:'ride-1'})"),false);
 assert.deepEqual(env.nav.pop(),{kind:"replace",url:"https://localhost/modules/entregador/index.html#/courier"});
 console.log("[OK] QA285 "+file+": both CTAs preserve their target; conflicts explain active role; push still locked.");
}
function verifyActiveMotoristaRecovery(file){
 const env=shellScenario(file);
 // Reported real scenario: Entregador marker stayed behind, while Motorista
 // was already ONLINE. The driver must regain ACCESS to its own module.
 env.store.set("apois-parceiro:operational-role","entregador");
 env.store.set("apois:driver:online","1");
 env.click("motorista");
 assert.deepEqual(env.nav.pop(),{
  kind:"assign",
  url:"https://localhost/modules/motorista/index.html#/motorista/app"
 },"driver online recovery must open the actual Motorista module");
 assert.equal(env.warning.hidden,true,"no courier-offline warning while already active as Motorista");
 assert.equal(env.store.get("apois-parceiro:operational-role"),"entregador",
  "the selector must not silently clear another module's backend-guarding lock");
 assert.equal(env.store.get("apois-parceiro:last-module"),"motorista",
  "last selected module must match user intent");

 // A stale marker alone is NOT permission to start operating in another role.
 // With no driver online evidence, the prior safe block is preserved.
 env.store.set("apois:driver:online","0");
 env.click("motorista");
 assert.equal(env.nav.length,0,"no active evidence => retain explicit role lock");
 assert.equal(env.warning.hidden,false,"uncertain cross-role state requires a warning");
 assert.ok(env.description.textContent.includes("Entregador"));
 assert.ok(env.description.textContent.includes("Motorista"));
 console.log("[OK] QA287 "+file+": active Motorista re-entry, lock safety, and unknown-state fallback.");
}
test("QA287: active Motorista can reclaim correct login/app after stale Entregador marker",()=>{
 verifyActiveMotoristaRecovery("superapp/partner-shell/index.html");
});
if(process.argv.includes("--dist"))
 test("QA287: built Android shell preserves active Motorista re-entry without altering presence",()=>{
  verifyActiveMotoristaRecovery("superapp/partner-shell/dist/index.html");
 });
test("Partner selector source buttons do not silently cross role",()=>verify("superapp/partner-shell/index.html"));
if(process.argv.includes("--dist"))
 test("Partner final Android shell bundle preserves CTA routing",()=>verify("superapp/partner-shell/dist/index.html"));
