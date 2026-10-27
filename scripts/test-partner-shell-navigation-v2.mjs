import { readFileSync } from "node:fs";
import { runInContext, createContext, Script } from "node:vm";
import assert from "node:assert/strict";

function testFile(path, label) {
  const html=readFileSync(path,"utf8");
  const match=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(match, label+": inline controller missing");
  new Script(match[1],{filename:path});
  const navigations=[];
  const storage=(data=new Map())=>({
    getItem:k=>data.get(k)??null,
    setItem:(k,v)=>data.set(k,String(v)),
    removeItem:k=>data.delete(k),
  });
  const localStorage=storage(),sessionStorage=storage();
  const context=createContext({
    URL,URLSearchParams,JSON,console,
    localStorage,sessionStorage,
    document:{querySelectorAll:()=>[]},
    window:{
      location:{
        origin:"https://localhost",
        pathname:"/modules/motorista/index.html",
        assign:(url)=>navigations.push({kind:"assign",url}),
        replace:(url)=>navigations.push({kind:"replace",url}),
      },
      Capacitor:null
    }
  });
  runInContext(match[1],context,{timeout:1000});
  const evaluate=src=>runInContext(src,context,{timeout:1000});
  assert.equal(evaluate("partnerModuleUrl('./modules/motorista/index.html#/motorista/app')"),"https://localhost/modules/motorista/index.html#/motorista/app");
  assert.equal(evaluate("partnerModuleUrl('./modules/entregador/index.html#/courier')"),"https://localhost/modules/entregador/index.html#/courier");
  assert.equal(evaluate("partnerModuleUrl('https://accounts.google.com/oauth2')"),"https://accounts.google.com/oauth2");
  assert.equal(evaluate("partnerModuleUrl('br.com.apois.parceiro://auth/callback')"),"br.com.apois.parceiro://auth/callback");
  assert.equal(evaluate("routeRole('motorista', urls.motorista)"),true);
  assert.deepEqual(navigations.pop(),{kind:"assign",url:"https://localhost/modules/motorista/index.html"});
  localStorage.setItem("apois-parceiro:operational-role","motorista");
  assert.equal(evaluate("routeRole('entregador', urls.entregador)"),false);
  assert.deepEqual(navigations.pop(),{kind:"replace",url:"https://localhost/modules/motorista/index.html#/motorista/app"});
  assert.equal(evaluate("relayPartnerPush({notificationType:'delivery_offer',orderId:'order-1'})"),false);
  assert.deepEqual(navigations.pop(),{kind:"replace",url:"https://localhost/modules/motorista/index.html#/motorista/app"});
  assert.equal(evaluate("relayPartnerPush({notificationType:'delivery_offer',orderId:'order-1',rideId:'ride-1'})"),false);
  assert.equal(navigations.length,0);
  localStorage.setItem("apois-parceiro:operational-role","entregador");
  assert.equal(evaluate("relayPartnerPush({notificationType:'delivery_offer',orderId:'order-1'})"),true);
  assert.deepEqual(navigations.pop(),{kind:"assign",url:"https://localhost/modules/entregador/index.html#/courier"});
  assert.equal(navigations.length,0);
  console.log("[OK] "+label+": nested WebView URLs, role lock, cross-module push, and OAuth URLs.");
}
testFile("superapp/partner-shell/index.html","Partner shell source");
if(process.argv.includes("--dist"))testFile("superapp/partner-shell/dist/index.html","Partner shell final bundle");
