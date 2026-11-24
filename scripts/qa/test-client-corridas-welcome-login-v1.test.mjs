/** APOIS_CLIENT_WELCOME_APPROVED_V1 + APOIS_CLIENT_LOGIN_APPROVED_V1 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {Script,runInNewContext} from 'node:vm';
import {patchLogin,marker} from '../apply-client-corridas-approved-login-v1.mjs';

const html=readFileSync(resolve('superapp/shell/corridas-only.html'),'utf8');
const boot=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
function setupBoot({url=null}={}){
 const handlers={};const navigation=[];const values={};const sessions={};
 const app={addListener:async (_n,callback)=>{handlers.native=callback;},getLaunchUrl:async()=>url?{url}:{}};
 const context={
  window:{location:{replace:target=>navigation.push(target)},Capacitor:{Plugins:{App:app,Browser:{close:async()=>{}}}}},
  document:{getElementById:id=>id==='apois-corridas-welcome-enter'?{addEventListener:(name,fn)=>handlers[name]=fn}:null},
  localStorage:{setItem:(k,v)=>values[k]=v,getItem:k=>values[k]??null,removeItem:k=>delete values[k]},
  sessionStorage:{setItem:(k,v)=>sessions[k]=v,getItem:k=>sessions[k]??null},
  URL,URLSearchParams,Date,console,
 };
 runInNewContext(boot,context);
 return {handlers,navigation,values,sessions};
}

test('welcome uses the exact isolated Corridas shell; a single real button routes to original login',async()=>{
 assert.match(html,/APOIS_CLIENT_WELCOME_APPROVED_V1/);
 assert.match(html,/data-apois-client-welcome-v1/);
 assert.equal((html.match(/<button\b/g)||[]).length,1);
 assert.ok(html.includes('id="apois-corridas-welcome-enter"'));
 assert.ok(html.includes('src="./assets/apois-brand.png"'));
 assert.ok(html.includes('data:image/webp;base64,'));
 assert.ok(html.includes('#F51D2A')&&html.includes('#BB071D')&&html.includes('#0D0F12'));
 assert.ok(!html.includes('modules/entregas'));
 assert.ok(!html.includes('data-module="entregas"'));
 assert.ok(boot,'native boot script missing');
 new Script(boot);
 const ui=setupBoot();
 await Promise.resolve();await Promise.resolve();
 assert.deepEqual(ui.navigation,[],'ordinary startup must show welcome instead of skipping to home');
 assert.equal(typeof ui.handlers.click,'function');
 ui.handlers.click();
 assert.deepEqual(ui.navigation,['./modules/corridas/index.html#/login']);
 assert.equal(ui.values['apois-superapp:last-module'],'corridas');
});

test('Google callbacks and password reset keep their existing direct handoff, never show welcome while resuming auth',async()=>{
 const url='br.com.apois.app://auth/corridas-google?code=sample123';
 const g=setupBoot({url});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(g.navigation,['./modules/corridas/index.html#/login']);
 assert.ok(g.values['apois-superapp:corridas-google-url'].includes('sample123'));
 const reset=setupBoot({url:'br.com.apois.app://auth/corridas-reset?code=123'});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(reset.navigation,['./modules/corridas/index.html']);
 assert.ok(reset.sessions['apois-superapp:corridas-recovery-url']);
});

const referenceLogin=`import { PassengerGoogleLoginButton } from "@/components/auth/PassengerGoogleLoginButton";
const foo=async()=>supabase.auth.signInWithPassword({email,password});
const handleLogin=()=>undefined;
const auth=()=><div className="relative min-h-[100dvh] flex-1 overflow-hidden bg-[#F7F7F8] px-5">
<div className="relative z-10"><div className="mb-5 mt-4 flex justify-center"><img src={logo} alt="APOIS" /></div>
<h1 data-apois-client-login-title-v2 className="mx-auto text-[30px]">Entrar na sua <span className="text-[#E51B23]">conta</span></h1>
<p>Acesse com e-mail e senha ou continue com sua conta Google.</p>
<label htmlFor="login-email" className="mb-2 block text-[15px] font-extrabold">E-mail</label>
<Input id="login-email" autoComplete="email" placeholder="seu@email.com" disabled={loading}/>
<label htmlFor="login-password" className="mb-2 block text-[15px] font-extrabold">Senha</label>
<Input id="login-password" autoComplete="current-password" placeholder="Digite sua senha" disabled={loading}/>
<button onClick={()=>setShowPassword(v=>!v)} />
<Link to="/recuperar-senha" />
<PassengerGoogleLoginButton />
<Link to="/cadastro" />
</div></div>;
`;

test('real login patch is visual only, keeps password, Google, recovery, signup and stays idempotent',()=>{
 const result=patchLogin(referenceLogin,'/* existing stylesheet */\n');
 const again=patchLogin(result.login,result.css);
 assert.deepEqual(again,result);
 for(const token of ['supabase.auth.signInWithPassword','PassengerGoogleLoginButton','<PassengerGoogleLoginButton />',
  'to="/recuperar-senha"','to="/cadastro"','autoComplete="email"','autoComplete="current-password"',
  'onClick={()=>setShowPassword(v=>!v)}','disabled={loading}'])assert.ok(result.login.includes(token),token);
 for(const token of [marker,'data-apois-client-login-approved-v1','data-apois-approved-login-logo',
  'Entrar na sua conta','Acesse com e-mail e senha para solicitar suas corridas.'])assert.ok(result.login.includes(token),token);
 assert.ok(result.css.includes('#F51D2A'));
 assert.ok(result.css.includes('#BB071D'));
 assert.ok(result.css.includes('button[aria-label="Continuar com Google"]'));
 assert.ok(!result.login.includes('dirigir com a APOIS'));
 assert.ok(!result.login.includes('modules/entregas'));
});

test('login patch fails closed when a protected callback or form field changed',()=>{
 assert.throws(()=>patchLogin(referenceLogin.replace('supabase.auth.signInWithPassword','unavailableFn'),'css'),/existing real authentication/);
 assert.throws(()=>patchLogin(referenceLogin.replace('Entrar na sua <span','Bem-vindo <span'),'css'),/generated title changed/);
 assert.throws(()=>patchLogin(referenceLogin.replace('onClick={()=>setShowPassword(v=>!v)}','onClick={()=>undefined}'),'css'),/existing real authentication/);
});

if(process.argv.includes('--built'))test('compiled app has welcome and real login, and no delivery module or switcher',()=>{
 const base='superapp/shell/dist';
 const start=readFileSync(resolve(base,'index.html'),'utf8');
 assert.ok(start.includes('data-apois-client-welcome-v1'));
 assert.ok(start.includes('id="apois-corridas-welcome-enter"'));
 assert.ok(start.includes('data:image/png;base64,'),'official brand must be inlined by shell builder');
 assert.ok(!existsSync(resolve(base,'modules/entregas')));
 const route=readFileSync(resolve('.work/corridas/src/routes/_public.login.tsx'),'utf8');
 const css=readFileSync(resolve('.work/corridas/src/styles.css'),'utf8');
 assert.ok(route.includes('data-apois-client-login-approved-v1'));
 assert.ok(css.includes('APOIS_CLIENT_LOGIN_APPROVED_V1'));
 assert.ok(route.includes('PassengerGoogleLoginButton'));
 assert.ok(route.includes('supabase.auth.signInWithPassword'));
});