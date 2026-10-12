import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=process.cwd();
const workspace=process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function file(rel){ return resolve(root,workspace,rel); }
function read(rel){ return readFileSync(file(rel),'utf8'); }
function write(rel,src){ writeFileSync(file(rel),src,'utf8'); }
function must(src,markers,label){
  const missing=markers.filter((m)=>!src.includes(m));
  if(missing.length) throw new Error('[FAIL] '+label+': '+missing.join(' | '));
}

// Reescreve visualmente apenas o JSX da tela de login; toda a lógica de auth,
// timeout, validação, navegação e Google continua sendo a já endurecida.
{
  const rel='src/routes/motorista.login.tsx';
  let src=read(rel);
  const fn=src.indexOf('function DriverLoginPage()');
  const start=src.indexOf('  return (',fn);
  const end=src.indexOf('\n  );\n}',start);
  if(fn<0||start<0||end<0) throw new Error('[FAIL] login Motorista: bloco JSX não encontrado');

  const jsx=`  return (
    <main data-apois-partner-auth-v18 className="min-h-[100dvh] bg-[#F7F7F8] text-[#111827]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-[calc(env(safe-area-inset-top)+18px)]">
        <header className="flex justify-center">
          <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-white p-1.5 shadow-[0_18px_45px_-28px_rgba(17,24,39,.32)] ring-1 ring-[#E5E7EB]">
            <img src={APOIS_PARTNER_LOGO_DATA_URL} alt="APOIS" className="h-full w-full rounded-full object-contain" />
          </div>
        </header>

        <section className="mt-5 text-center">
          <div className="text-[11px] font-black uppercase tracking-[0.22em] text-[#E51B23]">APOIS MOTORISTA</div>
          <h1 className="mt-2 text-[30px] font-black leading-[1.08] tracking-[-0.04em] text-[#111827]">Entre na sua conta</h1>
          <p className="mx-auto mt-2 max-w-[300px] text-[13px] font-medium leading-5 text-[#6B7280]">Fique online, receba corridas e acompanhe seus ganhos.</p>
        </section>

        <form onSubmit={onSubmit} method="post" className="mt-7 space-y-4" aria-busy={loading}>
          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-[#5F6670]">E-mail</span>
            <div className="flex h-[58px] items-center gap-3 rounded-[18px] border border-[#D9DDE3] bg-white px-4 shadow-sm focus-within:border-[#E51B23] focus-within:ring-2 focus-within:ring-[#E51B23]/10">
              <Mail className="h-5 w-5 shrink-0 text-[#E51B23]" strokeWidth={1.9} aria-hidden="true" />
              <input name="email" type="email" required autoComplete="email" inputMode="email" placeholder="Digite seu e-mail" className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
            </div>
          </label>

          <label className="block">
            <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-[#5F6670]">Senha</span>
            <div className="flex h-[58px] items-center gap-3 rounded-[18px] border border-[#D9DDE3] bg-white px-3 pl-4 shadow-sm focus-within:border-[#E51B23] focus-within:ring-2 focus-within:ring-[#E51B23]/10">
              <LockKeyhole className="h-5 w-5 shrink-0 text-[#E51B23]" strokeWidth={1.9} aria-hidden="true" />
              <input name="password" type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Digite sua senha" className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] outline-none placeholder:text-[#9CA3AF]" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#6B7280] transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E51B23]">{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
            </div>
          </label>

          <div className="flex justify-end"><DriverRecoveryLink to="/motorista/recuperar-senha" className="inline-flex min-h-11 items-center px-1 py-2 text-[12px] font-black text-[#E51B23]">Esqueci minha senha</DriverRecoveryLink></div>

          {error ? <div role="alert" aria-live="assertive" className="flex items-start gap-2 rounded-[16px] border border-red-200 bg-red-50 px-3.5 py-3 text-[11px] font-semibold leading-relaxed text-red-700"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span className="flex-1 break-words">{error}</span></div> : null}

          <button type="submit" disabled={loading} aria-busy={loading} className="flex min-h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-[#E51B23] px-4 py-3 text-[16px] font-black text-white shadow-[0_16px_34px_-22px_rgba(229,27,35,.55)] transition active:scale-[.99] disabled:opacity-60">{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : null}{loading ? "Entrando..." : "Entrar"}{!loading ? <ChevronRight className="h-5 w-5" strokeWidth={2.7} /> : null}</button>
        </form>

        <div className="mt-3"><DriverGoogleLoginButton /></div>

        <div className="mt-5 text-center">
          <p className="text-[12px] font-semibold text-[#6B7280]">Ainda não tem uma conta?</p>
          <Link to="/motorista/cadastro" className="mt-1 inline-flex min-h-11 items-center justify-center gap-1.5 px-3 py-2 text-[13px] font-black text-[#E51B23]">Cadastrar como motorista<ChevronRight className="h-4 w-4" /></Link>
        </div>

        <div className="mt-3 flex items-start gap-3 rounded-[18px] border border-[#E5E7EB] bg-white px-4 py-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#E51B23]" />
          <div><p className="text-[12px] font-black text-[#111827]">Sua segurança é prioridade</p><p className="mt-0.5 text-[10.5px] font-medium leading-relaxed text-[#6B7280]">PIN no embarque e recursos de segurança durante a corrida.</p></div>
        </div>

        <p className="mt-4 text-center text-[9px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">APOIS Parceiro • visual 18</p>
      </div>
    </main>
  );`;

  src=src.slice(0,start)+jsx+src.slice(end+'\n  );'.length);
  must(src,['data-apois-partner-auth-v18','APOIS Parceiro • visual 18','DriverGoogleLoginButton'],'login Motorista v18');
  if(src.includes('background: "#111418"')) throw new Error('[FAIL] login Motorista v18 reteve painel escuro');
  write(rel,src);
}

// Painel ocioso: branco, cartões suaves e CTA vermelho. Mantém todos os estados.
{
  const rel='src/routes/motorista.app.tsx';
  let src=read(rel);
  src=src
    .replace('background: "#111418",\n        borderTop: "1px solid rgba(255,255,255,0.06)",','background: "#FFFFFF",\n        borderTop: "1px solid #E5E7EB",')
    .replace('className="mx-auto mt-2.5 h-[4px] w-10 rounded-full bg-white/10"','className="mx-auto mt-2.5 h-[4px] w-10 rounded-full bg-[#D1D5DB]"')
    .replace('? "bg-primary/12 text-primary"\n                : "bg-white/5 text-muted-foreground"','? "bg-[#FFF1F2] text-[#E51B23]"\n                : "bg-[#F3F4F6] text-[#6B7280]"')
    .replace('style={{ border: online ? "1px solid color-mix(in oklab, var(--color-primary) 30%, transparent)" : "1px solid rgba(255,255,255,0.06)" }}','style={{ border: online ? "1px solid rgba(229,27,35,.22)" : "1px solid #E5E7EB" }}')
    .replace('online\n              ? "text-foreground hover:bg-white/[0.04]"','online\n              ? "border border-[#D9DDE3] bg-white text-[#111827] hover:bg-[#F9FAFB]"')
    .replace('? { background: "#0e1114", border: "1px solid rgba(255,255,255,0.08)" }','? { background: "#FFFFFF", border: "1px solid #D9DDE3" }')
    .replace('style={{ background: "#0e1114", border: "1px solid rgba(255,255,255,0.06)" }}','style={{ background: "#F7F7F8", border: "1px solid #E5E7EB" }}');
  must(src,['background: "#FFFFFF"','background: "#F7F7F8"','Corridas hoje','Ganhos hoje'],'painel inicial Motorista v18');
  write(rel,src);
}

// Navegação inferior: remove barra preta da interface antiga.
{
  const rel='src/components/ApoisDriverBottomNav.tsx';
  let src=read(rel)
    .replace('shadow-[0_-18px_46px_rgba(0,0,0,.52)]','border-t border-[#E5E7EB] shadow-[0_-10px_28px_-20px_rgba(17,24,39,.22)]')
    .replace('background: "linear-gradient(180deg, rgba(8,10,12,.90), rgba(4,5,6,.985))",','background: "rgba(255,255,255,.98)",')
    .replace('borderTop: "1px solid rgba(229,27,35,.12)",','borderTop: "1px solid #E5E7EB",')
    .replaceAll('text-zinc-400','text-[#6B7280]')
    .replaceAll('focus-visible:ring-offset-[#050607]','focus-visible:ring-offset-white')
    .replaceAll('driver-nav-active bg-[#E51B23]/[.08] text-[#E51B23] ring-1 ring-inset ring-[#E51B23]/15','driver-nav-active bg-[#FFF1F2] text-[#E51B23] ring-1 ring-inset ring-[#E51B23]/15');
  must(src,['background: "rgba(255,255,255,.98)"','text-[#6B7280]'],'navegação Motorista clara v18');
  write(rel,src);
}

console.log('[OK] Motorista Parceiro visual v18 aplicado: login, painel inicial e navegação inferior sem casca escura legada.');
