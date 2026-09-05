import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';

function path(relative) {
  return resolve(root, workspace, relative);
}

function replaceRequired(relative, search, replacement, label) {
  const target = path(relative);
  const before = readFileSync(target, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!before.includes(search)) {
    throw new Error(`[FAIL] ${label}: padrão esperado não encontrado em ${relative}`);
  }
  writeFileSync(target, before.replace(search, replacement), 'utf8');
  console.log(`[OK] ${label}`);
}

const authPath = path('src/hooks/use-auth.tsx');
let auth = readFileSync(authPath, 'utf8');

auth = auth.replace(
  `export type AuthState =\n  | "initializing"\n  | "authenticated"\n  | "unauthenticated"\n  | "configuration_error"\n  | "connection_error";`,
  `export type AuthState =\n  | "initializing"\n  | "loading_profile"\n  | "authenticated"\n  | "unauthenticated"\n  | "profile_missing"\n  | "configuration_error"\n  | "connection_error";`,
);

auth = auth.replace(
  `.from("users")\n        .select("*")\n        .eq("id", userId)\n        .maybeSingle();`,
  `.from("users")\n        .select("*")\n        .eq("auth_user_id", userId)\n        .maybeSingle();`,
);

// Requisição de profile supersedida não significa profile ausente. Preserve a
// sessão mais nova e não deixe uma promessa antiga sobrescrever o authState.
auth = auth.replaceAll(
  'if (requestId !== activeProfileRequest.current) return null;',
  'if (requestId !== activeProfileRequest.current) return undefined;',
);

auth = auth.replace(
  `      setAuthState("authenticated");\n      await fetchProfile(nextSession.user.id);`,
  `      setAuthState("loading_profile");\n      setError(null);\n      const resolvedProfile = await fetchProfile(nextSession.user.id);\n      if (resolvedProfile === undefined) return;\n      if (resolvedProfile) {\n        setAuthState("authenticated");\n        return;\n      }\n\n      setAuthState("profile_missing");\n      setError(\n        "Sua autenticação foi concluída, mas o perfil de passageiro ainda não está disponível. Tente novamente ou saia e entre de novo.",\n      );`,
);

for (const marker of [
  '| "loading_profile"',
  '| "profile_missing"',
  '.eq("auth_user_id", userId)',
  'setAuthState("loading_profile")',
  'setAuthState("profile_missing")',
  'if (resolvedProfile === undefined) return;',
]) {
  if (!auth.includes(marker)) {
    throw new Error(`[FAIL] Corridas auth: correção incompleta (${marker}).`);
  }
}
if (auth.includes('.from("users")\n        .select("*")\n        .eq("id", userId)')) {
  throw new Error('[FAIL] Corridas auth ainda procura public.users.id pelo auth UUID.');
}
writeFileSync(authPath, auth, 'utf8');
console.log('[OK] Corridas: AuthProvider resolve profile por users.auth_user_id e só autentica após profile válido.');

// Consumidores de tabelas que referenciam public.users.id devem usar profile.id
// (DOMAIN USER ID), não auth.users.id. Mantemos o auth UUID apenas onde a tabela
// referencia auth.users diretamente (por exemplo tokens de push do app).
replaceRequired(
  'src/hooks/rides/use-active-ride.tsx',
  '  const { user } = useAuth();\n  const userId = user?.id ?? null;',
  '  const { profile } = useAuth();\n  const userId = profile?.id ?? null;',
  'Corridas: ActiveRide usa domain user id do profile',
);
replaceRequired(
  'src/hooks/use-wallet.tsx',
  '  const { user } = useAuth();\n  const userId = user?.id ?? null;',
  '  const { profile } = useAuth();\n  const userId = profile?.id ?? null;',
  'Corridas: Wallet usa domain user id do profile',
);
replaceRequired(
  'src/routes/_authenticated.notificacoes.tsx',
  '  const { user } = useAuth();\n  const userId = user?.id ?? null;',
  '  const { profile } = useAuth();\n  const userId = profile?.id ?? null;',
  'Corridas: notificações de domínio usam profile.id',
);

const guardPath = path('src/components/auth/AuthGuard.tsx');
let guard = readFileSync(guardPath, 'utf8');

guard = guard.replace(
  '  const { authState } = useAuth();',
  '  const { authState, error, refreshSession, signOut } = useAuth();',
);

guard = guard.replace(
  '    if (authState === "initializing") return;',
  '    if (authState === "initializing" || authState === "loading_profile") return;',
);

guard = guard.replace(
  '  if (authState === "initializing") {',
  '  if (authState === "initializing" || authState === "loading_profile") {',
);

guard = guard.replace(
  `  // If not authenticated, we show nothing (useEffect will redirect)\n  if (authState !== "authenticated") {\n    return null;\n  }`,
  `  if (authState === "profile_missing" || authState === "connection_error" || authState === "configuration_error") {\n    return (\n      <div className="flex min-h-screen flex-col items-center justify-center bg-black p-6 text-center text-white">\n        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-5">\n          <h1 className="text-lg font-black">Não foi possível concluir o acesso</h1>\n          <p className="mt-2 text-sm leading-relaxed text-zinc-400">\n            {error ||\n              (authState === "profile_missing"\n                ? "Seu login foi confirmado, mas o perfil de passageiro ainda não está disponível."\n                : "Não foi possível validar sua conta agora.")}\n          </p>\n          <div className="mt-5 grid gap-2">\n            <button\n              type="button"\n              onClick={() => void refreshSession()}\n              className="min-h-12 rounded-xl bg-apois-yellow px-4 font-black text-black"\n            >\n              Tentar novamente\n            </button>\n            <button\n              type="button"\n              onClick={() => void signOut()}\n              className="min-h-12 rounded-xl border border-zinc-700 px-4 font-bold text-zinc-200"\n            >\n              Sair da conta\n            </button>\n          </div>\n        </div>\n      </div>\n    );\n  }\n\n  // If not authenticated, we show nothing while the redirect effect runs.\n  if (authState !== "authenticated") return null;`,
);

for (const marker of [
  'authState === "initializing" || authState === "loading_profile"',
  'authState === "profile_missing"',
  'onClick={() => void refreshSession()}',
  'onClick={() => void signOut()}',
]) {
  if (!guard.includes(marker)) {
    throw new Error(`[FAIL] Corridas AuthGuard: estado recuperável ausente (${marker}).`);
  }
}
writeFileSync(guardPath, guard, 'utf8');
console.log('[OK] Corridas: AuthGuard diferencia carregamento de profile, profile ausente e erro recuperável.');
