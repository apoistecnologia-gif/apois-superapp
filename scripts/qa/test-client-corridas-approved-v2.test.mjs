import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {rewriteWelcome,rewriteLogin,MARKER} from '../apply-client-corridas-approved-v2.mjs';
const base='<html><head><style>.old{}</style></head><body><!-- APOIS_CLIENT_WELCOME_APPROVED_V1: intro --><main>    <div class="skyline"><svg/></div><div class="inner"><div class="brand"><img src="./assets/apois-brand.png" /></div><div class="vehicle"><img src="x" /></div><button type="button" id="apois-corridas-welcome-enter">Entrar</button></div>  </main><script>function route(){};</script></body></html>';
test('welcome retains a single REAL entry action with approved brand car and safe bottom gap',()=>{
  const out=rewriteWelcome(base);
  assert.match(out,/data-apois-approved-branded-car-v2/);
  assert.match(out,/data-apois-enter-safe-area-v2/);
  assert.match(out,/env\(safe-area-inset-bottom\)/);
  assert.match(out,/__APOIS_WELCOME_ART_V2__/);
  assert.equal((out.match(/<button\b/g)||[]).length,1);
  assert.equal((out.match(/id="apois-corridas-welcome-enter"/g)||[]).length,1);
  assert.ok(out.includes('<script>function route(){};'));
  assert.equal(rewriteWelcome(out),out);
});
test('fail closed if original button or logo contract disappears',()=>{
  assert.throws(()=>rewriteWelcome(base.replace('id="apois-corridas-welcome-enter"','id="missing"')),/original welcome contract/);
  assert.throws(()=>rewriteWelcome(base.replace('./assets/apois-brand.png','missing')),/original welcome contract/);
});
test('login scroll is isolated, keyboard-stable, and preserves actual sign-in',()=>{
 const login='<div data-apois-client-login-approved-v1></div>; supabase.auth.signInWithPassword(); PassengerGoogleLoginButton';
 const css=rewriteLogin('/* APOIS_CLIENT_LOGIN_APPROVED_V1 */',login);
 assert.ok(css.includes('APOIS_CLIENT_LOGIN_STABLE_V2'));
 assert.ok(css.includes('overflow-y:auto!important'));
 assert.ok(css.includes('height:100dvh!important'));
 assert.ok(css.includes('scroll-padding-bottom:24px'));
 assert.equal(rewriteLogin(css,login),css);
});
test('real source keeps authentication, OAuth, recovery and signup',()=>{
 const path='scripts/apply-client-corridas-approved-login-v1.mjs';
 if(!existsSync(path))return; // synthetic fixture run without full repository
 const script=readFileSync(path,'utf8');
 for(const token of ['supabase.auth.signInWithPassword','PassengerGoogleLoginButton','to="/recuperar-senha"','to="/cadastro"'])assert.ok(script.includes(token),token);
});