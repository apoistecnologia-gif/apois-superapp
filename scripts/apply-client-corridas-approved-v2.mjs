/**
 * APOIS_CLIENT_APPROVED_ART_V2
 * Fix screenshot-identified UX regressions in disposable Corridas-only client shell:
 * branded car, comfortably raised REAL enter button, keyboard-stable REAL login.
 * No auth implementation, module, backend or protected submodule is touched.
 */
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MARKER = 'APOIS_CLIENT_APPROVED_ART_V2';
const welcome = resolve('superapp/shell/corridas-only.html');
const moduleRoot=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const login=resolve(moduleRoot,'src/routes/_public.login.tsx');
const styles=resolve(moduleRoot,'src/styles.css');

export function rewriteWelcome(source){
  if(source.includes(MARKER))return source;
  for(const token of ['APOIS_CLIENT_WELCOME_APPROVED_V1','id="apois-corridas-welcome-enter"','<script>','./assets/apois-brand.png', '<div class="inner">']){
    if(!source.includes(token))throw Error(`[FAIL] ${MARKER}: original welcome contract missing ${token}`);
  }
  // New hero image comes from approved artwork. It deliberately excludes the
  // rasterized button: there must be only ONE truly interactive Enter control.
  const regex=/<style>[\s\S]*?<\/style>/;
  if((source.match(/<style>/g)||[]).length!==1)throw Error(`[FAIL] ${MARKER}: CSS boundary changed`);
  const css=`<style>
  :root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;--red:#F51D2A;--red-dark:#BB071D;--black:#0D0F12}
  *{box-sizing:border-box}
  html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--black);color:#fff;overscroll-behavior:none;-webkit-text-size-adjust:100%}
  body{position:fixed;inset:0}
  .apois-welcome{width:100%;height:100dvh;max-width:560px;margin:auto;display:flex;flex-direction:column;overflow:hidden;background:var(--black);isolation:isolate}
  .apois-hero{flex:1 1 auto;min-height:0;overflow:hidden;position:relative}
  .apois-hero img{display:block;width:100%;height:100%;object-fit:cover;object-position:center;user-select:none;-webkit-user-drag:none}
  .apois-enter-foot{flex:0 0 auto;background:linear-gradient(180deg,#09090C,#0D0F12);padding:9px 22px max(34px,calc(env(safe-area-inset-bottom) + 20px));}
  #apois-corridas-welcome-enter{width:100%;min-height:60px;border:1px solid rgba(255,255,255,.13);border-radius:999px;display:flex;gap:20px;align-items:center;justify-content:center;background:linear-gradient(135deg,#F51D2A 0%,#EC0920 50%,#BB071D 100%);box-shadow:0 10px 26px rgba(187,7,29,.25);color:#fff;font-size:clamp(20px,6vw,26px);font-weight:900;touch-action:manipulation;cursor:pointer}
  #apois-corridas-welcome-enter:active{transform:scale(.985)}
  #apois-corridas-welcome-enter:focus-visible{outline:3px solid #fff;outline-offset:4px}
  #apois-corridas-welcome-enter svg{width:24px;height:24px;stroke:currentColor;stroke-width:2.8;fill:none;stroke-linecap:round;stroke-linejoin:round}
  .brand-asset-check{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  @media(max-height:690px){.apois-enter-foot{padding-top:6px;padding-bottom:max(23px,calc(env(safe-area-inset-bottom) + 12px))}#apois-corridas-welcome-enter{min-height:54px}}
  @media(prefers-reduced-motion:reduce){#apois-corridas-welcome-enter{transition:none}}
  </style>`;
  let result=source.replace(regex,css);
  const start=result.indexOf('    <div class="skyline"');
  const end=result.indexOf('  </main>',start);
  if(start<0||end<start||!result.slice(start,end).includes('<div class="vehicle"'))throw Error(`[FAIL] ${MARKER}: live welcome structure changed`);
  const asset=`<div class="apois-hero" data-apois-approved-branded-car-v2 role="img" aria-label="APOIS Corridas, mobilidade que move você, carro adesivado com a marca APOIS">
      <img src="__APOIS_WELCOME_ART_V2__" alt="" aria-hidden="true" />
      <img class="brand-asset-check" src="./assets/apois-brand.png" alt="" aria-hidden="true" />
    </div>
    <div class="apois-enter-foot" data-apois-enter-safe-area-v2>
      <button type="button" id="apois-corridas-welcome-enter" aria-label="Entrar na minha conta APOIS Corridas">Entrar <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
    </div>
`;
  result=result.slice(0,start)+asset+result.slice(end);
  result=result.replace('<!-- APOIS_CLIENT_WELCOME_APPROVED_V1:',`<!-- ${MARKER}: branded car, raised functional enter button; APOIS_CLIENT_WELCOME_APPROVED_V1:`);
  for(const token of ['id="apois-corridas-welcome-enter"','data-apois-approved-branded-car-v2','data-apois-enter-safe-area-v2','./assets/apois-brand.png','<script>'])if(!result.includes(token))throw Error(`[FAIL] ${MARKER}: missing final ${token}`);
  if((result.match(/<button\b/g)||[]).length!==1)throw Error(`[FAIL] ${MARKER}: welcome must have exactly one action`);
  return result;
}

export const stableCSS=`\n/* APOIS_CLIENT_LOGIN_STABLE_V2: keep form viewport still as keyboard resizes Android WebView. */
[data-apois-client-login-approved-v1]{height:100dvh!important;min-height:0!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;overscroll-behavior:none!important;padding-top:max(10px,env(safe-area-inset-top))!important;padding-bottom:max(12px,env(safe-area-inset-bottom))!important;}
[data-apois-client-login-approved-v1]>div.relative{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch;scrollbar-width:none;scroll-padding-bottom:24px;}
[data-apois-client-login-approved-v1]>div.relative::-webkit-scrollbar{display:none}
[data-apois-client-login-approved-v1] .mt-auto.min-h-24{display:none!important}
[data-apois-client-login-approved-v1] [data-apois-approved-login-logo]{margin-top:clamp(2px,1.2dvh,12px)!important;margin-bottom:8px!important}
[data-apois-client-login-approved-v1] [data-apois-approved-login-logo] img{height:clamp(82px,13dvh,116px)!important;width:clamp(82px,13dvh,116px)!important}
[data-apois-client-login-approved-v1] [data-apois-approved-login-logo]+div{margin-bottom:12px!important}
[data-apois-client-login-approved-v1] form{gap:11px!important}
[data-apois-client-login-approved-v1] input[id="login-email"],[data-apois-client-login-approved-v1] input[id="login-password"]{height:52px!important;min-height:52px!important}
[data-apois-client-login-approved-v1] form button[type="submit"]{height:55px!important;min-height:55px!important}
@media(max-height:680px){[data-apois-client-login-approved-v1] [data-apois-approved-login-logo] img{height:74px!important;width:74px!important}[data-apois-client-login-approved-v1] [data-apois-client-login-title-v2]+p{font-size:13px!important}[data-apois-client-login-approved-v1] form{gap:8px!important}}
`;
export function rewriteLogin(css,loginText){
 if(!loginText.includes('data-apois-client-login-approved-v1')||!loginText.includes('supabase.auth.signInWithPassword')||!loginText.includes('PassengerGoogleLoginButton'))throw Error(`[FAIL] ${MARKER}: real login was modified or absent`);
 if(!css.includes('APOIS_CLIENT_LOGIN_APPROVED_V1'))throw Error(`[FAIL] ${MARKER}: approved design prerequisite absent`);
 return css.includes('APOIS_CLIENT_LOGIN_STABLE_V2')?css:css+stableCSS;
}

export function apply(){
 const html=readFileSync(welcome,'utf8');
 const patched=rewriteWelcome(html);
 if(!patched.includes('__APOIS_WELCOME_ART_V2__'))throw Error(`[FAIL] ${MARKER}: branded hero missing`);
 const img64=readFileSync(resolve('superapp/branding/apois-corridas-welcome-v2.webp.b64'),'utf8').trim();
 if(img64.length<20000||!/^[A-Za-z0-9+/=]+$/.test(img64))throw Error(`[FAIL] ${MARKER}: branded car asset invalid`);
 const finalized=patched.replace('__APOIS_WELCOME_ART_V2__','data:image/webp;base64,'+img64);
 const l=readFileSync(login,'utf8'),c=readFileSync(styles,'utf8');
 const updatedCSS=rewriteLogin(c,l);
 // Permanent JSX data attribute survives Vite and can be checked inside the APK.
 const contract='data-apois-client-login-approved-v1 className=';
 if(l.split(contract).length!==2)throw Error('[FAIL] '+MARKER+': login route root changed');
 const stableRoute=l.replace(contract,'data-apois-client-login-approved-v1 data-apois-client-login-stable-v2="true" className=');
 if(finalized!==html)writeFileSync(welcome,finalized,'utf8');
 if(stableRoute!==l)writeFileSync(login,stableRoute,'utf8');
 if(updatedCSS!==c)writeFileSync(styles,updatedCSS,'utf8');
 console.log(`[OK] ${MARKER}: approved car artwork, raised real Enter, keyboard-stable live login`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))apply();