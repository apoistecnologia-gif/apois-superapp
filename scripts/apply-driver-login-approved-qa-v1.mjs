/**
 * APOIS_DRIVER_APPROVED_AUTH_V1
 * Approved presentation-only transform on .work/partner-motorista.
 * Preserves existing Motorista email/password/Google/reset/signup logic, navigation,
 * active rides, native GPS, and protected pinned source repos.
 */
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||'.work/partner-motorista');
const login=resolve(root,'src/routes/motorista.login.tsx');
const cssPath=resolve(root,'src/styles.css');
export const MARKER='APOIS_DRIVER_APPROVED_AUTH_V1';
function check(src,tokens,label){for(const token of tokens){if(!src.includes(token))throw Error('[FAIL] '+MARKER+': '+label+' missing '+token);}}
export function patchLogin(source){
 if(source.includes('data-apois-driver-approved-login-v1'))throw Error('[FAIL] '+MARKER+': duplicate patch');
 check(source,[
  'function DriverLoginPage()',
  'supabase.auth.signInWithPassword',
  '<DriverGoogleLoginButton />',
  'to="/motorista/recuperar-senha"',
  'to="/motorista/cadastro"',
  'APOIS_PARTNER_LOGO_DATA_URL',
  'onSubmit={onSubmit}',
 ],'preserve real Motorista login');
 const fn=source.indexOf('function DriverLoginPage()');
 const start=source.indexOf('  return (',fn);
 const end=source.indexOf('\n  );\n}',start);
 if(fn<0||start<0||end<0)throw Error('[FAIL] '+MARKER+': existing login render boundary changed');
 const nativeEntryState = `  // APOIS_DRIVER_WELCOME_ROUTE_V2 — only the isolated Android shell.
  const [showWelcome,setShowWelcome]=useState(()=>{
    if(typeof window==="undefined" || !window.location.pathname.includes("/modules/motorista/"))return false;
    try{
      const callbackKeys=["apois-parceiro:motorista-google-url","apois-parceiro:motorista-recovery-url","apois-driver-password-updated-v2","apois-driver-await-email-v4","apois-driver-welcome-entered-v2"];
      if(callbackKeys.some(key=>sessionStorage.getItem(key)))return false;
      if(/[?&#](code|access_token|refresh_token|error|type)=/.test(window.location.href))return false;
    }catch{return false;}
    return true;
  });
  useEffect(()=>{
    try{sessionStorage.removeItem("apois-driver-welcome-entered-v2");}catch{}
  },[]);
`;
 const jsx=`  return (
    <main data-apois-driver-approved-login-v1 className="apois-driver-login-v1 fixed inset-0 flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-[#0D0F12]">
      <div className="apois-driver-login-scroll-v1" hidden={showWelcome}>
        <div className="apois-driver-login-content-v2">
          {typeof window!=="undefined" && window.location.pathname.includes("/modules/motorista/") && <button type="button" onClick={()=>setShowWelcome(true)} className="apois-driver-login-back-v2" aria-label="Voltar às boas-vindas"><ChevronRight aria-hidden="true" className="h-5 w-5 rotate-180"/> Voltar</button>}
        <header className="apois-driver-brand-v2">
          <img src={APOIS_PARTNER_LOGO_DATA_URL} alt="APOIS" width={64} height={64} />
          <div><p>APOIS</p><span>Motorista</span></div>
        </header>
        <section className="apois-driver-intro-v2">
          <h1>Entrar na sua conta</h1>
          <p>Acesse com e-mail e senha para dirigir com a APOIS Motorista.</p>
        </section>
        <form onSubmit={onSubmit} method="post" aria-busy={loading} className="apois-driver-login-form-v2 flex flex-col gap-3">
          <label className="relative flex h-[50px] items-center gap-3 rounded-xl border border-[#D9DDE3] bg-white px-3 focus-within:border-[#D50923] focus-within:ring-2 focus-within:ring-[#D50923]/10">
            <Mail className="h-5 w-5 shrink-0 text-[#E60019]" aria-hidden="true" />
            <input name="email" type="email" required autoComplete="email" inputMode="email" aria-label="E-mail" placeholder="E-mail" className="h-full min-w-0 flex-1 bg-transparent text-base text-[#0D0F12] outline-none placeholder:text-[#68717C]" />
          </label>
          <label className="relative flex h-[50px] items-center gap-3 rounded-xl border border-[#D9DDE3] bg-white px-3 focus-within:border-[#D50923] focus-within:ring-2 focus-within:ring-[#D50923]/10">
            <LockKeyhole className="h-5 w-5 shrink-0 text-[#E60019]" aria-hidden="true" />
            <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" aria-label="Senha" placeholder="Senha" className="h-full min-w-0 flex-1 bg-transparent text-base text-[#0D0F12] outline-none placeholder:text-[#68717C]" />
            <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)} className="grid h-11 w-11 shrink-0 place-items-center text-[#686F79] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F51D2A]">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          </label>
          <div className="-mt-1 flex justify-end"><DriverRecoveryLink to="/motorista/recuperar-senha" className="inline-flex min-h-11 items-center px-1 text-[13px] font-bold text-[#BB071D]">Esqueci minha senha</DriverRecoveryLink></div>
          {error?.includes("Continuar cadastro com esta conta") ? <button type="button" data-apois-existing-driver-cta-v7 onClick={()=>navigate({to:"/motorista/cadastro"})} className="min-h-12 w-full rounded-2xl border border-[#E7B0B7] bg-white px-3 py-2 text-sm font-bold text-[#BB071D]">Continuar cadastro de motorista com esta conta</button> : null}
          {error ? <div role="alert" aria-live="assertive" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-medium text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{error}</span></div> : null}
          <button type="submit" disabled={loading} aria-busy={loading} className="apois-driver-submit-v2 flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-[#D50923] px-4 text-base font-bold text-white disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{loading ? "Entrando..." : "Entrar"}{!loading ? <ChevronRight className="h-5 w-5" strokeWidth={2.7} /> : null}</button>
        </form>
        <div className="mt-4 flex items-center gap-3 text-[#686F79]"><div className="h-px flex-1 bg-[#D4D6DC]" /><span className="text-[13px] font-semibold">ou</span><div className="h-px flex-1 bg-[#D4D6DC]" /></div>
        <div className="apois-driver-google-approved-v1 mt-4"><DriverGoogleLoginButton /></div>
        <p className="apois-driver-signup-v2">Ainda não tem uma conta? <Link to="/motorista/cadastro" className="font-bold text-[#BB071D]">Criar conta</Link></p>
        </div>
      </div>
      {showWelcome && <section data-apois-driver-inline-welcome-v2 className="apois-driver-inline-welcome-v2" aria-label="Boas-vindas APOIS Motorista">
        <img src="../../assets/apois-motorista-hero.webp" alt="APOIS Motorista. Dirija com liberdade e ganhe no seu ritmo."/>
        <button type="button" onClick={()=>setShowWelcome(false)}>Entrar <ChevronRight aria-hidden="true" className="h-5 w-5"/></button>
      </section>}
    </main>
  );`;
 const next=source.slice(0,start)+nativeEntryState+jsx+source.slice(end+'\n  );'.length);
 check(next,['data-apois-driver-approved-login-v1','supabase.auth.signInWithPassword','<DriverGoogleLoginButton />','to="/motorista/recuperar-senha"','to="/motorista/cadastro"','data-apois-existing-driver-cta-v7'],'new render');
 if((next.match(/<DriverGoogleLoginButton\s*\/>/g)||[]).length!==1)throw Error('[FAIL] duplicate Google');
 return next;
}
export const style=`
/* APOIS_MOTORISTA_VISUAL_REF_20261124_LOGIN — stable modern white/red revision V2 */
.apois-driver-login-v1{position:fixed!important;inset:0!important;height:auto!important;min-height:0!important;max-height:none!important;width:100%!important;overflow:hidden!important;overscroll-behavior:none!important;background:#fff!important;color:#0D0F12!important;animation:none!important;transition:none!important;transform:none!important}
.apois-driver-login-v1::before,.apois-driver-login-v1::after{content:none!important;display:none!important}
.apois-driver-login-scroll-v1{position:absolute!important;inset:0!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:none!important;scroll-behavior:auto!important;scrollbar-width:none!important;overflow-anchor:none;touch-action:pan-y;animation:none!important;transform:none!important;background:#fff!important}
.apois-driver-login-scroll-v1[hidden]{display:none!important}
.apois-driver-login-scroll-v1::-webkit-scrollbar{display:none}
.apois-driver-login-content-v2{box-sizing:border-box;max-width:440px;width:100%;margin:0 auto;padding:max(40px,calc(env(safe-area-inset-top) + 12px)) max(22px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom)) max(22px,env(safe-area-inset-left));animation:none!important;transform:none!important}
.apois-driver-login-back-v2{display:inline-flex;align-items:center;gap:5px;min-height:40px;color:#5A626E;font-size:13px;font-weight:650;margin-bottom:14px}
.apois-driver-brand-v2{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.apois-driver-brand-v2 img{width:64px;height:64px;flex:none;object-fit:contain;animation:none!important;transform:none!important}
.apois-driver-brand-v2 p{font-size:25px;font-weight:850;line-height:1.1;letter-spacing:-.03em;color:#0D0F12;margin:0}
.apois-driver-brand-v2 span{font-size:13px;font-weight:750;color:#D50923;letter-spacing:.05em}
.apois-driver-intro-v2 h1{font-size:clamp(24px,6.7vw,30px);font-weight:800;line-height:1.15;letter-spacing:-.035em;margin:0;color:#0D0F12}
.apois-driver-intro-v2 p{font-size:14px;line-height:1.5;color:#535C65;margin:8px 0 0}
.apois-driver-login-form-v2{margin-top:20px;gap:10px}
.apois-driver-login-scroll-v1 form input{font-size:16px!important;min-width:0}
.apois-driver-google-approved-v1 button{width:100%!important;min-height:48px!important;border:1px solid #D9DDE3!important;border-radius:12px!important;background:#fff!important;color:#0D0F12!important;font-size:14px!important;font-weight:700!important;box-shadow:none!important}
.apois-driver-signup-v2{text-align:center;color:#535C65;font-size:13px;line-height:1.5;margin:18px 0 0}
.apois-driver-signup-v2 a{display:inline-block;padding:8px 4px;color:#BB071D!important}
.apois-driver-inline-welcome-v2{position:absolute!important;inset:0!important;display:flex;flex-direction:column;align-items:center;gap:8px;background:#0D0F12;padding:max(32px,env(safe-area-inset-top)) 16px max(16px,env(safe-area-inset-bottom));overflow:hidden;animation:none!important}
.apois-driver-inline-welcome-v2 img{width:100%;max-width:480px;flex:1 1 0;min-height:0;object-fit:contain;animation:none!important}
.apois-driver-inline-welcome-v2 button{width:100%;max-width:440px;min-height:48px;flex:none;border-radius:14px;background:#D50923;color:white;display:flex;align-items:center;justify-content:center;gap:12px;font-size:16px;font-weight:750}
@media(max-height:680px){.apois-driver-login-content-v2{padding-top:max(28px,env(safe-area-inset-top));padding-bottom:max(12px,env(safe-area-inset-bottom))}.apois-driver-login-back-v2{margin-bottom:6px;min-height:36px}.apois-driver-brand-v2{margin-bottom:14px}.apois-driver-brand-v2 img{width:52px;height:52px}.apois-driver-login-form-v2{margin-top:12px;gap:8px}}
`;
export function apply(){
 const logo=readFileSync(resolve('superapp/branding/apois-client-red-logo.b64'),'utf8').trim();
 if(!logo.startsWith('iVBORw0KGgo')) throw Error('[FAIL] Logo oficial APOIS ausente');
 const loginSource=readFileSync(login,'utf8');
 const oldImport='import { MovviLogo } from "@/components/MovviLogo";';
 if(loginSource.split(oldImport).length!==2)throw Error('[FAIL] Login original alterado: exige analise antes de substituir a identidade');
 const logoModule=resolve(root,'src/assets/apoisPartnerLogoData.ts');
 writeFileSync(logoModule,'export const APOIS_PARTNER_LOGO_DATA_URL = "data:image/png;base64,'+logo+'";\n','utf8');
 const prepared=loginSource.replace(oldImport,'import { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";');
 const src=prepared;
 const before=readFileSync(cssPath,'utf8');
 if(before.includes(MARKER))throw Error('[FAIL] '+MARKER+': already present in CSS');
 const next=patchLogin(src);
 writeFileSync(login,next,'utf8');
 writeFileSync(cssPath,before+style,'utf8');
 console.log('[OK] '+MARKER+': approved Driver login, real auth preserved');
}
if(process.argv[1]?.endsWith('apply-driver-login-approved-qa-v1.mjs'))apply();