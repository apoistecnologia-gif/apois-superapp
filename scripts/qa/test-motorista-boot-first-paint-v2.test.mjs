/**
 * Regression: an Android Capacitor App.getLaunchUrl() promise can remain
 * pending. Never hide all content while awaiting a native callback.
 * These tests exercise the real Partner shell, not a second mock HTML page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script, createContext, runInContext } from 'node:vm';

const file='superapp/partner-shell/index.html';
const html=readFileSync(file,'utf8');
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'real partner shell must retain native controller');
const runtime=new Script(match[1],{filename:file});
const makeStorage=()=> {
  const data=new Map();
  return {
    getItem:key=>data.get(key)??null,
    setItem:(key,val)=>data.set(key,String(val)),
    removeItem:key=>data.delete(key),
    data
  };
};
function launch({pending=true,launchUrl=null,role=null}={}) {
  const navigations=[],handlers=new Map(),localStorage=makeStorage(),sessionStorage=makeStorage();
  if(role)localStorage.setItem('apois-parceiro:operational-role',role);
  const button={addEventListener(name,fn){handlers.set(name,fn)}};
  const App={
    addListener:()=>Promise.resolve(),
    getLaunchUrl:pending?()=>new Promise(()=>{}):()=>Promise.resolve({url:launchUrl})
  };
  const window={
    location:{
      origin:'https://localhost',
      assign:url=>navigations.push({type:'assign',url}),
      replace:url=>navigations.push({type:'replace',url})
    },
    Capacitor:{Plugins:{App}}
  };
  const ctx=createContext({
    URL, URLSearchParams, JSON, console, localStorage, sessionStorage, window,
    document:{
      getElementById:id=>id==='apois-driver-welcome-enter'?button:null,
      querySelectorAll:()=>[]
    }
  });
  runtime.runInContext(ctx,{timeout:1500});
  return {navigations,button,handlers,ctx,localStorage,sessionStorage};
}

test('Approved Motorista welcome is visible immediately in Capacitor root HTML',()=>{
  assert.match(html,/APOIS_MOTORISTA_DIRECT_WELCOME_BOOT_V2/);
  assert.match(html,/<main class="apois-driver-launch" data-apois-driver-direct-welcome-v2/);
  assert.match(html,/<img src="\.\/assets\/apois-motorista-hero\.webp"/);
  assert.match(html,/<button id="apois-driver-welcome-enter" type="button">Entrar/);
  assert.match(html,/padding-top:max\(54px,calc\(env\(safe-area-inset-top\) \+ 28px\)\)/);
  assert.match(html,/padding:9px 22px max\(70px,calc\(env\(safe-area-inset-bottom\) \+ 45px\)\)/);
  assert.match(html,/<main class="screen" data-apois-legacy-role-chooser hidden aria-hidden="true">/);
  assert.ok(html.indexOf('data-apois-driver-direct-welcome-v2') < html.indexOf('data-apois-legacy-role-chooser hidden'),
    'first accessible screen must be the approved welcome');
  assert.ok(!html.includes("window.location.replace('./motorista-welcome.html')"),
    'never rely on a second-page redirect from a hidden first page');
});

test('Native App.getLaunchUrl never resolves: no blank view and Entrar remains usable',()=>{
  const page=launch({pending:true});
  assert.equal(page.navigations.length,0,'no redirect must be required to see welcome');
  assert.equal(typeof page.handlers.get('click'),'function','visible Entrar must have a click handler');
  page.handlers.get('click')();
  assert.deepEqual(page.navigations,[{
    type:'assign',url:'https://localhost/modules/motorista/index.html#/motorista/login'
  }]);
});

test('Live Motorista operation is routed directly after native launch callback',async()=>{
  const page=launch({pending:false,role:'motorista'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(page.navigations,[{
    type:'replace',url:'https://localhost/modules/motorista/index.html#/motorista/app'
  }]);
});

test('Google callback bypasses the welcome and enters real login',async()=>{
  const callback='br.com.apois.parceiro://auth/google?code=untrusted-test-only';
  const page=launch({pending:false,launchUrl:callback});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(page.sessionStorage.getItem('apois-parceiro:motorista-google-url'),callback);
  assert.deepEqual(page.navigations,[{
    type:'assign',url:'https://localhost/modules/motorista/index.html#/motorista/login'
  }]);
});
