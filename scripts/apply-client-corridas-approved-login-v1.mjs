/**
 * APOIS_CLIENT_LOGIN_APPROVED_V1
 * Apply only the user-approved APOIS Corridas login presentation to the
 * disposable passenger module. Keeps the LIVE email/password, Google PKCE,
 * password recovery, account creation, auth callbacks, and navigation intact.
 * Never edits source-lock, protected submodules, rides, maps or backend.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export const marker='APOIS_CLIENT_LOGIN_APPROVED_V1';
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas');
const loginPath=resolve(root,'src/routes/_public.login.tsx');
const cssPath=resolve(root,'src/styles.css');

function once(s,needle,replacement,label){
  const count=s.split(needle).length-1;
  if(count!==1)throw Error(`[FAIL] ${marker}: ${label} changed (${count})`);
  return s.replace(needle,replacement);
}
function preserve(s,markers,label){
 for(const token of markers)if(!s.includes(token))throw Error(`[FAIL] ${marker}: ${label} lost ${token}`);
}

const presentationCSS=String.raw`
/* APOIS_CLIENT_LOGIN_APPROVED_V1: real passenger login, approved red/white/black UI. */
[data-apois-client-login-approved-v1]{
  isolation:isolate;position:relative;min-height:100dvh;background:#FFFFFF!important;color:#0D0F12!important;
  padding-top:max(24px,env(safe-area-inset-top))!important;
  padding-bottom:max(26px,env(safe-area-inset-bottom))!important;
}
[data-apois-client-login-approved-v1]::before{
  content:"";position:absolute;z-index:0;pointer-events:none;top:-125px;left:-72px;width:390px;height:240px;
  transform:rotate(-28deg);border-radius:0 0 85% 0;background:linear-gradient(145deg,#BB071D,#F51D2A);
}
[data-apois-client-login-approved-v1]::after{
  content:"";position:absolute;z-index:0;pointer-events:none;left:-20%;right:-20%;bottom:-110px;height:165px;
  transform:rotate(-10deg);border-radius:50% 50% 0 0;background:linear-gradient(130deg,#F51D2A,#BB071D);
}
[data-apois-client-login-approved-v1]>div.pointer-events-none{display:none!important;}
[data-apois-client-login-approved-v1]>div.relative{z-index:1!important;}
[data-apois-approved-login-logo]{display:flex;flex-direction:column;align-items:center;margin-top:clamp(12px,3dvh,30px)!important;margin-bottom:18px!important;}
[data-apois-approved-login-logo] img{display:block;width:clamp(105px,27vw,140px)!important;height:clamp(105px,27vw,140px)!important;object-fit:contain!important;filter:drop-shadow(0 4px 10px rgba(13,15,18,.08));}
[data-apois-approved-login-logo]::after{content:"Corridas";display:block;width:max-content;margin:5px auto 0;padding:3px 22px 5px;
  border-radius:999px;background:linear-gradient(120deg,#F51D2A,#BB071D);color:#fff;font-size:20px;font-weight:900;line-height:1.15;}
[data-apois-client-login-title-v2]{font-size:clamp(26px,7vw,33px)!important;font-weight:950!important;line-height:1.1!important;
  padding:0!important;max-width:100%!important;letter-spacing:-.035em!important;color:#0D0F12!important;text-wrap:balance;}
[data-apois-client-login-approved-v1] [data-apois-client-login-title-v2]+p{color:#686F79!important;
  max-width:290px;margin-top:9px!important;font-size:14px!important;line-height:1.45!important;}
[data-apois-client-login-approved-v1] [data-apois-approved-login-logo]+div{margin-bottom:20px!important;}
[data-apois-client-login-approved-v1] .rounded-\[30px\]{border:0!important;border-radius:24px!important;
  background:rgba(255,255,255,.98)!important;box-shadow:none!important;
  padding:clamp(8px,2.4vw,16px)!important;backdrop-filter:none!important;}
[data-apois-client-login-approved-v1] form{display:flex;flex-direction:column;gap:15px!important;}
[data-apois-client-login-approved-v1] form>div{min-width:0;}
[data-apois-client-login-approved-v1] input[id="login-email"],
[data-apois-client-login-approved-v1] input[id="login-password"]{
  min-height:57px!important;height:57px!important;background:#FFFFFF!important;
  border:1.5px solid #BABFC6!important;border-radius:999px!important;
  font-size:16px!important;font-weight:500!important;color:#0D0F12!important;
  padding-left:48px!important;box-shadow:0 2px 2px rgba(13,15,18,.015);
}
[data-apois-client-login-approved-v1] input::placeholder{color:#686F79!important;opacity:1!important;-webkit-text-fill-color:#686F79!important;}
[data-apois-client-login-approved-v1] input:focus-visible{outline:2px solid #F51D2A!important;outline-offset:1px!important;}
[data-apois-client-login-approved-v1] form svg{color:#E50920!important;}
[data-apois-client-login-approved-v1] form button[aria-label="Mostrar senha"],
[data-apois-client-login-approved-v1] form button[aria-label="Esconder senha"]{
  display:grid;place-items:center;min-width:44px;min-height:44px;right:7px!important;color:#0D0F12!important;
}
[data-apois-client-login-approved-v1] form button[aria-label="Mostrar senha"] svg,
[data-apois-client-login-approved-v1] form button[aria-label="Esconder senha"] svg{color:#0D0F12!important;}
[data-apois-client-login-approved-v1] form a[href*="recuperar-senha"]{color:#BB071D!important;font-weight:800!important;}
[data-apois-client-login-approved-v1] form button[type="submit"]{
  min-height:58px!important;height:58px!important;margin-top:0!important;border-radius:999px!important;
  background:linear-gradient(180deg,#F51D2A,#BB071D)!important;color:#fff!important;
  box-shadow:0 10px 24px rgba(187,7,29,.24)!important;font-size:19px!important;letter-spacing:-.01em;
}
[data-apois-client-login-approved-v1] form button[type="submit"] svg{color:#fff!important;}
[data-apois-client-login-approved-v1] button[aria-label="Continuar com Google"]{
  min-height:54px!important;height:54px!important;margin-top:0!important;border-radius:999px!important;
  border:1.5px solid #89919B!important;background:#FFFFFF!important;color:#0D0F12!important;
  box-shadow:none!important;font-size:15px!important;font-weight:800!important;
}
[data-apois-client-login-approved-v1] button[aria-label="Continuar com Google"] span{
  background:conic-gradient(from -40deg,#4285F4 0 38%,#34A853 38% 58%,#FBBC05 58% 72%,#EA4335 72% 88%,#4285F4 88%);
  color:transparent!important;background-clip:text;-webkit-background-clip:text;font-weight:950!important;font-size:24px!important;
}
[data-apois-client-login-approved-v1] a[href*="cadastro"]{color:#BB071D!important;}
[data-apois-client-login-approved-v1] .mt-auto.min-h-24{min-height:60px!important;}
@media(max-height:750px){
  [data-apois-approved-login-logo]{margin-top:6px!important;margin-bottom:9px!important;}
  [data-apois-approved-login-logo] img{height:92px!important;width:92px!important;}
  [data-apois-approved-login-logo]::after{font-size:16px;}
  [data-apois-client-login-approved-v1] [data-apois-approved-login-logo]+div{margin-bottom:9px!important;}
  [data-apois-client-login-approved-v1] .mt-auto.min-h-24{min-height:32px!important;}
  [data-apois-client-login-approved-v1] form{gap:10px!important;}
}
`;

export function patchLogin(login,css){
 const protectedControls=[
  'handleLogin','supabase.auth.signInWithPassword','data-apois-client-login-title-v2',
  'PassengerGoogleLoginButton','<PassengerGoogleLoginButton />',
  'to="/recuperar-senha"','to="/cadastro"',
  'autoComplete="email"','autoComplete="current-password"',
  'onClick={()=>setShowPassword(v=>!v)}',
  'disabled={loading}',
 ];
 preserve(login,protectedControls,'existing real authentication');
 if(login.includes(marker)){
  preserve(css,[marker,'button[aria-label="Continuar com Google"]'],'previous login stylesheet');
  return {login,css};
 }
 let result=login;
 result=once(result,'<div className="relative min-h-[100dvh] flex-1 overflow-hidden bg-[#F7F7F8]',
  '<div data-apois-client-login-approved-v1 className="relative min-h-[100dvh] flex-1 overflow-hidden bg-[#F7F7F8]','login root');
 result=once(result,'<div className="mb-5 mt-4 flex justify-center">',
  '<div data-apois-approved-login-logo className="mb-5 mt-4 flex justify-center">','official logo wrapper');
 const title=/<h1 data-apois-client-login-title-v2[^>]*>Entrar na sua <span className="[^"]*">conta<\/span><\/h1>/g;
 const matches=[...result.matchAll(title)];
 if(matches.length!==1)throw Error(`[FAIL] ${marker}: generated title changed (${matches.length})`);
 result=result.replace(title,'<h1 data-apois-client-login-title-v2 className="text-center font-black">Entrar na sua conta</h1>');
 result=once(result,'Acesse com e-mail e senha ou continue com sua conta Google.',
  'Acesse com e-mail e senha para solicitar suas corridas.','passenger subtitle');
 const labels='className="mb-2 block text-[15px] font-extrabold"';
 if(result.split(labels).length-1!==2)throw Error(`[FAIL] ${marker}: expected two accessible labels`);
 result=result.replaceAll(labels,'className="sr-only"');
 result=once(result,'placeholder="seu@email.com"','placeholder="E-mail"','email placeholder');
 result=once(result,'placeholder="Digite sua senha"','placeholder="Senha"','password placeholder');
 result=result.replaceAll('#E51B23','#F51D2A').replaceAll('#C9141B','#BB071D');
 result='// '+marker+'\n'+result;
 preserve(result,protectedControls,'patched real authentication');
 preserve(result,['data-apois-client-login-approved-v1','data-apois-approved-login-logo','Entrar na sua conta','Acesse com e-mail e senha para solicitar suas corridas.'],'approved layout');
 if(css.includes(marker))throw Error(`[FAIL] ${marker}: source/style marker mismatch`);
 return {login:result,css:css+'\n'+presentationCSS+'\n'};
}

export function applyLogin(){
 const before=readFileSync(loginPath,'utf8');
 const beforeCSS=readFileSync(cssPath,'utf8');
 const after=patchLogin(before,beforeCSS);
 const repeat=patchLogin(after.login,after.css);
 if(repeat.login!==after.login||repeat.css!==after.css)throw Error(`[FAIL] ${marker}: non-idempotent`);
 // No partial file writes on unexpected source drift.
 if(before!==after.login)writeFileSync(loginPath,after.login,'utf8');
 if(beforeCSS!==after.css)writeFileSync(cssPath,after.css,'utf8');
 console.log('[OK] APOIS Corridas: approved login presentation with real password, Google PKCE and account flows');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url))applyLogin();