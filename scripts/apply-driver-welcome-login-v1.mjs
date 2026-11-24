/**
 * APOIS_DRIVER_APPROVED_AUTH_V1
 * Final presentation-only transform on .work/partner-motorista.
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
 const jsx=`  return (
    <main data-apois-driver-approved-login-v1 className="apois-driver-login-v1 fixed inset-0 flex h-[100dvh] w-full flex-col overflow-hidden bg-white text-[#0D0F12]">
      <div className="apois-driver-login-scroll-v1 relative z-10 mx-auto w-full max-w-[460px] flex-1 overflow-y-auto overflow-x-hidden px-5 pb-[max(32px,calc(env(safe-area-inset-bottom)+20px))] pt-[max(58px,calc(env(safe-area-inset-top)+30px))]">
        <header className="flex flex-col items-center text-center">
          <img src={APOIS_PARTNER_LOGO_DATA_URL} alt="APOIS" className="h-[94px] w-[94px] rounded-full object-contain" />
          <p className="mt-1 text-[33px] font-black leading-tight tracking-[-.04em] text-black">APOIS</p>
          <span className="rounded-full bg-[#F51D2A] px-7 py-1 text-[16px] font-extrabold text-white">Motorista</span>
        </header>
        <section className="mt-5 text-center">
          <h1 className="text-[clamp(24px,7.1vw,30px)] font-black leading-tight tracking-[-.035em]">Entrar na sua conta</h1>
          <p className="mx-auto mt-2 max-w-[310px] text-[13px] font-medium leading-[1.5] text-[#686F79]">Acesse com e-mail e senha para dirigir com a APOIS Motorista.</p>
        </section>
        <form onSubmit={onSubmit} method="post" aria-busy={loading} className="mt-6 flex flex-col gap-3.5">
          <label className="relative flex h-[55px] items-center gap-3 rounded-full border border-[#B9BDC5] bg-white px-4 focus-within:border-[#F51D2A] focus-within:ring-2 focus-within:ring-red-100">
            <Mail className="h-5 w-5 shrink-0 text-[#BB071D]" aria-hidden="true" />
            <input name="email" type="email" required autoComplete="email" inputMode="email" aria-label="E-mail" placeholder="E-mail" className="h-full min-w-0 flex-1 bg-transparent text-base text-[#0D0F12] outline-none placeholder:text-[#686F79]" />
          </label>
          <label className="relative flex h-[55px] items-center gap-3 rounded-full border border-[#B9BDC5] bg-white px-4 focus-within:border-[#F51D2A] focus-within:ring-2 focus-within:ring-red-100">
            <LockKeyhole className="h-5 w-5 shrink-0 text-[#BB071D]" aria-hidden="true" />
            <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" aria-label="Senha" placeholder="Senha" className="h-full min-w-0 flex-1 bg-transparent text-base text-[#0D0F12] outline-none placeholder:text-[#686F79]" />
            <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword((v) => !v)} className="grid h-11 w-11 shrink-0 place-items-center text-[#686F79] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F51D2A]">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          </label>
          <div className="-mt-1 flex justify-end"><DriverRecoveryLink to="/motorista/recuperar-senha" className="inline-flex min-h-11 items-center px-1 text-[13px] font-bold text-[#BB071D]">Esqueci minha senha</DriverRecoveryLink></div>
          {/* Existing auth notices remain mutually exclusive with errors and password resets. */}
          {passwordUpdatedNotice ? <div data-apois-driver-password-updated-v2 role="status" aria-live="polite" className="rounded-2xl border border-[#99e5b9] bg-[#effcf4] p-3 text-xs font-semibold text-[#14532D]">Senha alterada com sucesso. Entre com sua nova senha. Esta alteração também atualiza o acesso da conta compartilhada com o APOIS Passageiro.</div> : null}
          {registrationNotice && !error && !passwordUpdatedNotice ? <div role="status" aria-live="polite" className="rounded-2xl border border-[#99e5b9] bg-[#effcf4] p-3 text-xs font-semibold text-[#14532D]">Verifique seu e-mail. Se recebeu uma confirmação, conclua-a e depois entre. Se a conta já existia, use sua senha ou a recuperação de acesso.</div> : null}
          {error?.includes("Continuar cadastro com esta conta") ? <button type="button" data-apois-existing-driver-cta-v7 onClick={()=>navigate({to:"/motorista/cadastro"})} className="min-h-12 w-full rounded-2xl border border-[#E7B0B7] bg-white px-3 py-2 text-sm font-bold text-[#BB071D]">Continuar cadastro de motorista com esta conta</button> : null}
          {error ? <div role="alert" aria-live="assertive" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-xs font-medium text-red-800"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{error}</span></div> : null}
          <button type="submit" disabled={loading} aria-busy={loading} className="flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-gradient-to-b from-[#F51D2A] to-[#BB071D] px-4 text-[18px] font-black text-white shadow-[0_8px_20px_rgba(187,7,29,.18)] disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{loading ? "Entrando..." : "Entrar"}{!loading ? <ChevronRight className="h-5 w-5" strokeWidth={2.7} /> : null}</button>
        </form>
        <div className="mt-4 flex items-center gap-3 text-[#686F79]"><div className="h-px flex-1 bg-[#D4D6DC]" /><span className="text-[13px] font-semibold">ou</span><div className="h-px flex-1 bg-[#D4D6DC]" /></div>
        <div className="apois-driver-google-approved-v1 mt-4"><DriverGoogleLoginButton /></div>
        <p className="mt-5 text-center text-[13px] text-[#686F79]">Ainda não tem uma conta? <Link to="/motorista/cadastro" className="font-black text-[#BB071D]">Criar conta</Link></p>
      </div>
    </main>
  );`;
 const next=source.slice(0,start)+jsx+source.slice(end+'\n  );'.length);
 check(next,['data-apois-driver-approved-login-v1','supabase.auth.signInWithPassword','<DriverGoogleLoginButton />','to="/motorista/recuperar-senha"','to="/motorista/cadastro"','registrationNotice && !error && !passwordUpdatedNotice','data-apois-driver-password-updated-v2','data-apois-existing-driver-cta-v7'],'new render');
 if((next.match(/<DriverGoogleLoginButton\s*\/>/g)||[]).length!==1)throw Error('[FAIL] duplicate Google');
 return next;
}
export const style=`\n/* APOIS_DRIVER_APPROVED_AUTH_V1 - real stable Motorista login, approved white/red presentation */
.apois-driver-login-v1{height:100dvh!important;overscroll-behavior:none!important;overflow:hidden!important}
.apois-driver-login-scroll-v1{overscroll-behavior:contain!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch;scroll-padding-bottom:24px}
.apois-driver-login-scroll-v1::-webkit-scrollbar{display:none}
.apois-driver-google-approved-v1 button{width:100%!important;min-height:54px!important;border:1px solid #AEB3BB!important;border-radius:9999px!important;background:#fff!important;color:#0D0F12!important;font-size:14px!important;font-weight:800!important}
@media(max-height:720px){.apois-driver-login-scroll-v1{padding-top:max(46px,calc(env(safe-area-inset-top) + 23px))!important}.apois-driver-login-scroll-v1 header img{height:74px!important;width:74px!important}.apois-driver-login-scroll-v1 section{margin-top:10px!important}.apois-driver-login-scroll-v1 form{margin-top:14px!important;gap:9px!important}}
`;
export function apply(){
 const src=readFileSync(login,'utf8');
 const before=readFileSync(cssPath,'utf8');
 if(before.includes(MARKER))throw Error('[FAIL] '+MARKER+': already present in CSS');
 const next=patchLogin(src);
 writeFileSync(login,next,'utf8');
 writeFileSync(cssPath,before+style,'utf8');
 console.log('[OK] '+MARKER+': approved Driver login, real auth preserved');
}
if(process.argv[1]?.endsWith('apply-driver-welcome-login-v1.mjs'))apply();