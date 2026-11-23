/**
 * QA288: regression of the actual manual Partner selector button listeners.
 *
 * Prior APKs: local operational-role "entregador" silently sent a Motorista
 * button to Entregador login (QA285), then showed a blocking warning (QA286-7)
 * even if Motorista was truly ONLINE in Supabase.
 *
 * Entering the SELECTED module is not going ONLINE. Do not change role lock or
 * backend presence from this selector. Push/deep-link routing remains fail-closed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script,createContext,runInContext} from "node:vm";
const DRIVER_URL="https://localhost/modules/motorista/index.html#/motorista/app";
const COURIER_URL="https://localhost/modules/entregador/index.html#/courier";

function shellScenario(file){
 const html=readFileSync(file,"utf8");
 const inline=html.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(inline,"Partner shell inline JS absent");
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
  removeItem:k=>data.delete(k),
 });
 const context=createContext({
  URL,URLSearchParams,console,JSON,
  localStorage:storage(store),sessionStorage:storage(temp),
  document:{
   querySelectorAll:()=>buttons,
   getElementById:id=>nodes[id]??null,
  },
  window:{
   location:{
    origin:"https://localhost",
    assign:url=>nav.push({kind:"assign",url}),
    replace:url=>nav.push({kind:"replace",url}),
   },
   Capacitor:null,
  },
 });
 new Script(inline[1],{filename:file}).runInContext(context,{timeout:1000});
 const evalJS=js=>runInContext(js,context,{timeout:1000});
 const click=role=>{
  const button=buttons.find(b=>b.dataset.module===role);
  assert.ok(button&&button.listeners.length===1,"missing click handler: "+role);
  button.listeners[0]();
 };
 return {html,store,nav,warning,description,open,dismiss,click,evalJS};
}
function verify(file){
 const env=shellScenario(file);
 for(const role of ["motorista","entregador"]){
  assert.equal(env.html.split('data-module="'+role+'"').length-1,2,
   "both visual CTA controls must select "+role);
 }
 assert.ok(env.html.includes("APOIS_QA288_MANUAL_ENTRY_ALWAYS_SELECTS_REQUESTED_ROLE"),
  "QA288 selection fix not included in this build");
 assert.ok(env.html.includes("function routeRole(requestedRole,target)"),"internal lock removed");
 assert.ok(env.html.includes("async function bootPartnerShell()"),"startup handling lost");
 const urlFor=role=>role==="motorista"?DRIVER_URL:COURIER_URL;
 // Test both buttons for every previous lock state. Never rely on local
 // 'apois:driver:online', which can be stale, missing or from the wrong module.
 for(const locked of [null,"motorista","entregador"]){
  if(locked===null)env.store.delete("apois-parceiro:operational-role");
  else env.store.set("apois-parceiro:operational-role",locked);
  for(const flag of [null,"0","1"]){
   if(flag===null)env.store.delete("apois:driver:online");
   else env.store.set("apois:driver:online",flag);
   for(const role of ["motorista","entregador"]){
    env.warning.hidden=true;
    env.click(role);
    assert.deepEqual(env.nav.pop(),{kind:"assign",url:urlFor(role)},
     "wrong module from "+role+" with lock="+locked+" and local driver flag="+flag);
    assert.equal(env.nav.length,0,"a manual action may only navigate once");
    assert.equal(env.warning.hidden,true,"manual selector may not show a blocking role warning");
    assert.equal(env.store.get("apois-parceiro:operational-role")??null,locked,
     "manual entry must never override a backend-confirmed role lock");
    assert.equal(env.store.get("apois:driver:online")??null,flag,
     "manual entry must not update presence state");
    assert.equal(env.store.get("apois-parceiro:last-module"),role,
     "remember the user-selected profile, not the prior locked profile");
   }
  }
 }
 // Cross-role external push routing retains the existing fail-closed rule.
 env.store.set("apois-parceiro:operational-role","motorista");
 assert.equal(env.evalJS("relayPartnerPush({notificationType:'delivery_offer',orderId:'courier-1'})"),false);
 assert.deepEqual(env.nav.pop(),{kind:"replace",url:DRIVER_URL});
 env.store.set("apois-parceiro:operational-role","entregador");
 assert.equal(env.evalJS("relayPartnerPush({notificationType:'driver_ride',rideId:'ride-1'})"),false);
 assert.deepEqual(env.nav.pop(),{kind:"replace",url:COURIER_URL});
 for(const forbidden of ["driver_set_presence","courier_set_availability","UPDATE public.drivers"]){
  assert.ok(!env.html.includes(forbidden),"selector must not alter operational presence");
 }
 console.log("[OK] QA288 "+file+": manual navigation 18 combinations correctly select intended role; internal push lock preserved.");
}
test("QA288: source shell manually enters selected profile with or without stale lock",()=>{
 verify("superapp/partner-shell/index.html");
});
if(process.argv.includes("--dist")){
 test("QA288: compiled APK shell keeps direct Motorista/Entregador links and untouched role state",()=>{
  verify("superapp/partner-shell/dist/index.html");
 });
}
