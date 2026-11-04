import './harden-corridas-superapp-push-isolation.mjs';
import './harden-corridas-superapp-google-auth.mjs';
import './harden-corridas-login-error-message.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function patch(path, transform, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado ou nativo)`);
    return;
  }
  writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}`);
}

function requireMarkers(path, markers, label) {
  const source = readFileSync(resolve(root, path), 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error(`[FAIL] ${label}: ${missing.join(' | ')}`);
  console.log(`[OK] ${label}`);
}

patch('.work/corridas/src/components/BottomNavigation.tsx', (source) => {
  let next = source;
  next = next.replace(
    'relative w-full bg-black border-t border-white/10 flex justify-around py-3 px-2 z-[100] pb-[calc(12px+env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.5)] shrink-0',
    'relative z-[100] grid w-full shrink-0 grid-cols-5 border-t border-white/10 bg-black px-2 pt-2.5 pb-[max(44px,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_rgba(0,0,0,0.55)]',
  );
  next = next.replace(
    'className={`flex flex-col items-center gap-1 transition-all active:scale-90 ${',
    'className={`flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 transition-all active:scale-90 ${',
  );
  next = next.replace('<item.icon size={22} strokeWidth={isActive ? 3 : 2} />', '<item.icon size={24} strokeWidth={isActive ? 2.8 : 2.1} />');
  next = next.replace('"text-[9px] font-black uppercase tracking-widest"', '"text-[10px] font-black leading-none"');
  return next;
}, 'Corridas: navegação inferior real recebe alvos móveis e safe area');

patch('.work/corridas/src/routes/_authenticated.perfil.tsx', (source) => {
  let next = source;
  next = next.replace('  Bell,\n', '');
  next = next.replace('  CreditCard,\n', '');
  next = next.replace(
    `          <p className="text-xs font-bold text-gray-500 px-2 pt-6 pb-2 uppercase tracking-wider">\n            Preferências\n          </p>\n\n          <div className="space-y-1">\n            <MenuLink icon={<Bell size={20} />} label="Notificações" />\n            <MenuLink icon={<CreditCard size={20} />} label="Pagamentos" />\n            <MenuLink icon={<Shield size={20} />} label="Segurança" />\n          </div>`,
    `          <p className="text-xs font-bold text-gray-500 px-2 pt-6 pb-2 uppercase tracking-wider">\n            Segurança e privacidade\n          </p>\n\n          <div className="space-y-1">\n            <MenuLink icon={<Shield size={20} />} label="Segurança" />\n          </div>`,
  );
  next = next.replace('className="flex flex-col min-h-screen bg-black text-white pb-24"', 'className="flex min-h-0 flex-1 flex-col bg-black text-white"');
  next = next.replace('      <div className="flex-1 overflow-y-auto">', '      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">');
  return next;
}, 'Corridas: Perfil real remove atalhos duplicados e corrige viewport');

patch('.work/corridas/src/routes/_authenticated.tsx', (source) => {
  if (source.includes('const hideBottomNavigation =')) return source;
  let next = source;
  next = next.replace(
    'function AuthenticatedLayout() {\n  return (',
    'function AuthenticatedLayout() {\n  const pathname = useRouterState({ select: (state) => state.location.pathname });\n  const hideBottomNavigation = pathname === "/buscar-destino" || pathname === "/revisar-solicitacao" || pathname.startsWith("/corrida/");\n\n  return (',
  );
  next = next.replace('                                      <BottomNavigation />', '                                      {!hideBottomNavigation ? <BottomNavigation /> : null}');
  return next;
}, 'Corridas: rodapé não invade busca, revisão ou corrida ativa');

requireMarkers(
  '.work/corridas/src/components/BottomNavigation.tsx',
  ['grid-cols-5', 'min-h-[64px]', 'pb-[max(44px,env(safe-area-inset-bottom))]', '<item.icon size={24}', 'Início', 'Corridas', 'Carteira', 'Notificações', 'Perfil'],
  'Corridas mantém cinco destinos oficiais no rodapé',
);
requireMarkers(
  '.work/corridas/src/routes/_authenticated.tsx',
  ['const hideBottomNavigation =', 'pathname === "/buscar-destino"', 'pathname.startsWith("/corrida/")', '!hideBottomNavigation ? <BottomNavigation />'],
  'Corridas layout autenticado compatível com jornadas fullscreen',
);
requireMarkers(
  '.work/corridas/src/routes/_authenticated.inicio.tsx',
  ['PassengerMap', 'Digite um endereço...', '<CategorySelector />'],
  'Corridas Home real preservada para o hardener visual',
);
requireMarkers(
  '.work/corridas/src/routes/_public.login.tsx',
  ['PassengerGoogleLoginButton', '<PassengerGoogleLoginButton />', 'to="/recuperar-senha"', 'invalidCredentials ? "E-mail ou senha incorretos."'],
  'Corridas login preserva Google, senha, recuperação e feedback correto de credenciais',
);

console.log('[OK] Corridas: UI base alinhada ao snapshot atual com Google Login restaurado');


patch('.work/corridas/src/hooks/use-auth.tsx', (source) => {
  let next = source;
  if (!next.includes('APOIS_RESUME_AUTH_SNAPSHOT_V1')) {
    const anchor = 'const PROFILE_RETRY_DELAYS_MS = [0, 350, 900];';
    const helper = `const PROFILE_RETRY_DELAYS_MS = [0, 350, 900];
const SUPERAPP_CORRIDAS_AUTH_STORAGE_KEY = "apois-superapp-corridas-auth-v1";

// APOIS_RESUME_AUTH_SNAPSHOT_V1
const readPersistedSessionSnapshot = (): Session | null => {
  try {
    const raw = window.localStorage.getItem(SUPERAPP_CORRIDAS_AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const candidate = parsed?.currentSession ?? parsed?.session ?? parsed;
    if (!candidate?.access_token || !candidate?.user?.id) return null;
    return candidate as Session;
  } catch {
    return null;
  }
};

const persistedBootSession = typeof window !== "undefined" ? readPersistedSessionSnapshot() : null;`;

    if (!next.includes(anchor)) throw new Error('Corridas: âncora de auth bootstrap não encontrada.');
    next = next.replace(anchor, helper)
      .replace(
        '  const [user, setUser] = useState<User | null>(null);',
        '  const [user, setUser] = useState<User | null>(() => persistedBootSession?.user ?? null);',
      )
      .replace(
        '  const [session, setSession] = useState<Session | null>(null);',
        '  const [session, setSession] = useState<Session | null>(() => persistedBootSession);',
      )
      .replace(
        '  const [authState, setAuthState] = useState<AuthState>("initializing");',
        '  const [authState, setAuthState] = useState<AuthState>(() => persistedBootSession?.user ? "authenticated" : "initializing");',
      )
      .replace(
        '  const [isLoading, setIsLoading] = useState(true);',
        '  const [isLoading, setIsLoading] = useState(() => !persistedBootSession?.user);',
      );
  }
  return next;
}, 'Corridas: sessão persistida é reidratada antes da validação assíncrona');

patch('.work/corridas/src/components/auth/AuthGuard.tsx', (source) => {
  let next = source;
  if (!next.includes('APOIS_RESUME_AUTH_GUARD_V1')) {
    next = next
      .replace(
        '  const { authState } = useAuth();',
        '  const { authState, session } = useAuth();',
      )
      .replace(
        '  const { authState, error, refreshSession, signOut } = useAuth();',
        '  const { authState, session, error, refreshSession, signOut } = useAuth();',
      )
      .replace(
        '  if (authState === "initializing") {',
        '  // APOIS_RESUME_AUTH_GUARD_V1\n  if (authState === "initializing" && !session?.user) {',
      )
      .replace(
        '  if (authState === "initializing" || authState === "loading_profile") {',
        '  // APOIS_RESUME_AUTH_GUARD_V1\n  if ((authState === "initializing" || authState === "loading_profile") && !session?.user) {',
      )
      .replace(
        '  if (authState !== "authenticated") return null;',
        '  if (authState !== "authenticated" && !(session?.user && authState === "loading_profile")) return null;',
      );
  }
  return next;
}, 'Corridas: retorno do segundo plano preserva a tela atual enquanto a sessão é revalidada');

requireMarkers('.work/corridas/src/hooks/use-auth.tsx', [
  'APOIS_RESUME_AUTH_SNAPSHOT_V1',
  'apois-superapp-corridas-auth-v1',
  'persistedBootSession?.user ?? null',
  'useState<Session | null>(() => persistedBootSession)',
], 'Corridas: bootstrap de sessão sem flash de autenticação');

requireMarkers('.work/corridas/src/components/auth/AuthGuard.tsx', [
  'APOIS_RESUME_AUTH_GUARD_V1',
  'session?.user',
], 'Corridas: AuthGuard não bloqueia retomada com sessão persistida');
