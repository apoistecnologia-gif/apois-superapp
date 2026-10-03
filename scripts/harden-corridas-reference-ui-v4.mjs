import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';

function read(relativePath) {
  return readFileSync(resolve(root, workspace, relativePath), 'utf8');
}
function write(relativePath, content) {
  writeFileSync(resolve(root, workspace, relativePath), content, 'utf8');
}
function ensure(condition, message) {
  if (!condition) throw new Error('[FAIL] ' + message);
}

// LOGIN — referência visual APOIS clara: branco/cinza predominante, preto estrutural e vermelho de ação.
// Mantém toda a lógica de autenticação existente; troca apenas o JSX final.
{
  const path = 'src/routes/_public.login.tsx';
  let source = read(path);

  source = source
    .replace(/\nconst logo = "data:image\/svg\+xml;base64,[^"]+";\n/, '\n')
    .replace(/\nimport logo from "@\/assets\/logo\.jpg";\n/, '\n');

  const returnStart = source.indexOf('  return (\n');
  const returnEnd = source.lastIndexOf('  );\n}');
  ensure(returnStart >= 0 && returnEnd > returnStart, 'Corridas login: bloco JSX final não localizado');

  const jsx = `  return (
    <div data-apois-reference-login-v4="true" className="relative flex min-h-0 flex-1 overflow-hidden bg-[#F7F7F8] text-[#111111]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_8%,rgba(229,27,35,.08),transparent_30%),linear-gradient(180deg,#FFFFFF_0%,#F7F7F8_58%,#F1F2F4_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] opacity-40 [background:linear-gradient(108deg,transparent_0_35%,rgba(229,27,35,.10)_35.5%_36%,transparent_36.5%_100%)]" />

      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[430px] flex-col overflow-y-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(18px,env(safe-area-inset-top))]">
        <div className="mb-4 flex items-center justify-center">
          <div className="flex items-center gap-2" aria-label="APOIS">
            <svg data-apois-logo-mark-v4="true" viewBox="0 0 512 512" aria-hidden="true" className="h-12 w-12 shrink-0" focusable="false">
              <path d="M75 401 213 101h78L154 401Z" fill="#E51B23" />
              <path d="M258 101h78l139 300h-94Z" fill="#C9141B" />
              <path d="M156 319h213l43 82H118Z" fill="#111111" />
              <path d="M246 175 214 246h48l31-71Z" fill="#242424" />
              <path d="M288 252 260 315h48l28-63Z" fill="#242424" />
            </svg>
            <span className="text-[34px] font-black leading-none tracking-[0.15em] text-[#111111]">POIS</span>
          </div>
        </div>

        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-[#E51B23]/20 bg-[#FFF1F2] px-4 py-2 text-xs font-black tracking-wide text-[#111111] shadow-[0_8px_24px_rgba(17,17,17,.05)]">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[#FFF1F2] text-[#E51B23]">●</span>
          Corridas
        </div>

        <div className="mb-6 text-center">
          <h1 className="text-[32px] font-black leading-tight tracking-[-0.035em]">Entrar na APOIS</h1>
          <p className="mx-auto mt-2 max-w-[330px] text-sm leading-6 text-[#666B73]">Acesse sua conta e continue sua jornada com mais mobilidade.</p>
        </div>

        <form onSubmit={handleLogin} className="w-full space-y-4" noValidate>
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="ml-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#666B73]">E-mail</label>
            <Input id="login-email" type="email" inputMode="email" autoCapitalize="none" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} className="h-14 w-full rounded-2xl border-[#E2E4E8] bg-white px-4 text-[#111111] placeholder:text-[#9CA1A9] focus:border-[#E51B23] focus:ring-1 focus:ring-[#E51B23]" autoComplete="email" />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="ml-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#666B73]">Senha</label>
            <div className="relative">
              <Input id="login-password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={loading} className="h-14 w-full rounded-2xl border-[#E2E4E8] bg-white px-4 pr-12 text-[#111111] placeholder:text-[#9CA1A9] focus:border-[#E51B23] focus:ring-1 focus:ring-[#E51B23]" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-xl text-[#666B73] active:bg-[#F1F2F4]" aria-label={showPassword ? "Esconder senha" : "Mostrar senha"}>
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Link to="/recuperar-senha" className="text-sm font-bold text-[#E51B23] transition active:opacity-70">Esqueci minha senha?</Link>
          </div>

          <button type="submit" disabled={loading} className="mt-2 flex h-14 w-full items-center justify-center rounded-2xl bg-[#E51B23] text-base font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_28px_rgba(229,27,35,.18)] active:bg-[#C9141B] transition active:scale-[0.985] disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" /> : "Entrar"}
          </button>
        </form>

        <div className="w-full"><PassengerGoogleLoginButton /></div>

        <div className="mt-7 rounded-2xl border border-[#E2E4E8] bg-white px-4 py-4 text-center">
          <span className="text-sm text-[#666B73]">Ainda não tem uma conta?</span>
          <Link to="/cadastro" className="mt-1 block text-sm font-black uppercase tracking-[0.12em] text-[#E51B23] transition active:opacity-70">Criar minha conta</Link>
        </div>

        <div className="mt-auto pt-7 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.32em] text-[#9CA1A9]">Mobilidade que te leva mais longe</p>
        </div>
      </div>
    </div>
  );
`;

  source = source.slice(0, returnStart) + jsx + source.slice(returnEnd + '  );\n}'.length);
  source += '\n}\n';

  ensure(source.includes('data-apois-reference-login-v4="true"'), 'Corridas login: marcador visual V4 ausente');
  ensure(source.includes('data-apois-logo-mark-v4="true"'), 'Corridas login: símbolo APOIS vetorial inline ausente');
  ensure(!source.includes('src="./apois-mark-v3.svg"'), 'Corridas login: símbolo ainda depende de asset relativo');
  ensure(source.includes('<PassengerGoogleLoginButton />'), 'Corridas login: Google OAuth desapareceu');
  ensure(source.includes('to="/recuperar-senha"'), 'Corridas login: recuperação de senha desapareceu');
  ensure(source.includes('onSubmit={handleLogin}'), 'Corridas login: submit por senha desapareceu');
  write(path, source);
  console.log('[OK] Corridas: login segue referência APOIS sem alterar autenticação');
}

// BUSCA — não desloca o documento quando o teclado abre.
// A rota ocupa somente o viewport útil já redimensionado pelo Android;
// cabeçalho/input ficam fixos e só os resultados rolam.
{
  const path = 'src/routes/_authenticated.buscar-destino.tsx';
  let source = read(path);

  source = source.replace(
    /\n  useEffect\(\(\) => \{\n    if \(isBottomSheetOpen\) \{\n      setTimeout\(\(\) => \{[\s\S]*?\n  \}, \[isBottomSheetOpen\]\);\n/,
    '\n',
  );

  source = source.replace(
    /\n  \/\/ APOIS_SEARCH_KEYBOARD_GUARD_V2[\s\S]*?\n  \}, \[query, isBottomSheetOpen\]\);/,
    `
  // APOIS_SEARCH_VIEWPORT_V4: trava o documento externo; o teclado só reduz
  // a área útil do WebView e a lista interna absorve o scroll.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previous = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverflow: body.style.overflow,
      bodyOverscroll: body.style.overscrollBehavior,
    };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    return () => {
      html.style.overflow = previous.htmlOverflow;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      body.style.overflow = previous.bodyOverflow;
      body.style.overscrollBehavior = previous.bodyOverscroll;
    };
  }, []);`,
  );

  source = source
    .replaceAll('inputRef.current?.focus({ preventScroll: true });\n        window.requestAnimationFrame(() => window.scrollTo(0, 0));', 'inputRef.current?.focus({ preventScroll: true });')
    .replace(
      'className="apois-kit-search-screen relative min-h-0 flex-1 overflow-hidden bg-[#F7F7F8]"',
      'className="apois-kit-search-screen relative h-full min-h-0 flex-1 overflow-hidden bg-[#F7F7F8]"',
    )
    .replace(
      'className="apois-kit-search-screen flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F7F7F8] relative"',
      'className="apois-kit-search-screen relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F7F8]"',
    )
    .replace(
      'className="absolute inset-0 z-[60] flex min-h-0 flex-col overflow-hidden bg-[#F7F7F8]"',
      'className="relative z-[60] flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#F7F7F8]"',
    )
    .replace(
      'className="shrink-0 z-30 bg-white/96 pt-2 pb-3 backdrop-blur-xl"',
      'className="z-30 shrink-0 bg-[#0b0e14]/96 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl"',
    )
    .replace(
      'className="apois-kit-search-results min-h-0 flex-1 mt-2 overflow-y-auto overscroll-contain [overflow-anchor:none]"',
      'className="apois-kit-search-results mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(18px,env(safe-area-inset-bottom))] [overflow-anchor:none]"',
    );

  if (!source.includes('data-apois-search-fullscreen-v3="true"')) {
    throw new Error('[FAIL] Corridas busca: fullscreen V3 desapareceu');
  }
  ensure(source.includes('APOIS_SEARCH_VIEWPORT_V4'), 'Corridas busca: viewport V4 ausente');
  ensure(!source.includes('setTimeout(() => {\n        inputRef.current?.focus'), 'Corridas busca: autofocus tardio ainda existe');
  ensure(!source.includes('window.scrollTo(0, 0)'), 'Corridas busca: scroll global forçado ainda existe');
  ensure(source.includes('pt-[max(12px,env(safe-area-inset-top))]'), 'Corridas busca: safe-area superior ausente');
  ensure(source.includes('overflow-y-auto overscroll-contain px-4'), 'Corridas busca: lista interna não é a única área rolável');
  write(path, source);
  console.log('[OK] Corridas: busca mantém campo ancorado e não empurra a tela ao abrir teclado');
}

console.log('[OK] APOIS_REFERENCE_UI_V4: login e busca corrigidos pela referência visual atual.');
