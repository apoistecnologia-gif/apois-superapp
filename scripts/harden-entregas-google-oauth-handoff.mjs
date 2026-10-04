import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/components/GoogleLoginButton.tsx');
let source = readFileSync(path, 'utf8');

const pendingKey = 'apois-superapp:pending-oauth-product';
const forwardKey = 'apois-superapp:entregas-google-url';
const callback = 'br.com.apois.app://auth/callback';
const ttlMs = 120_000;

function replaceRequired(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) throw new Error(`[FAIL] Entregas Google OAuth: ${label}`);
  source = source.replace(search, replacement);
}

if (!source.includes('const APOIS_GOOGLE_PENDING_KEY =')) {
  const anchor = '} as const;\n';
  if (!source.includes(anchor)) throw new Error('[FAIL] Entregas Google OAuth: bloco de schemes não encontrado');
  source = source.replace(
    anchor,
    `${anchor}\nconst APOIS_GOOGLE_PENDING_KEY = "${pendingKey}";\nconst APOIS_GOOGLE_FORWARD_KEY = "${forwardKey}";\nconst APOIS_GOOGLE_CALLBACK_TTL_MS = ${ttlMs};\n`,
  );
}

if (!source.includes('function consumeForwardedGoogleCallback()')) {
  const marker = 'export function GoogleLoginButton() {';
  const index = source.indexOf(marker);
  if (index < 0) throw new Error('[FAIL] Entregas Google OAuth: componente ausente');
  const helper = `function consumeForwardedGoogleCallback() {\n  let stored: string | null = null;\n  try {\n    stored = window.localStorage.getItem(APOIS_GOOGLE_FORWARD_KEY);\n    window.localStorage.removeItem(APOIS_GOOGLE_FORWARD_KEY);\n  } catch {\n    return null;\n  }\n  if (!stored) return null;\n  try {\n    const envelope = JSON.parse(stored) as { url?: unknown; createdAt?: unknown };\n    if (typeof envelope.url !== "string" || typeof envelope.createdAt !== "number") return null;\n    const age = Date.now() - envelope.createdAt;\n    if (age < 0 || age > APOIS_GOOGLE_CALLBACK_TTL_MS) return null;\n    const url = new URL(envelope.url);\n    if (url.protocol !== "br.com.apois.app:" || url.hostname !== "auth" || url.pathname !== "/callback") return null;\n    return envelope.url;\n  } catch {\n    return null;\n  }\n}\n\nfunction clearPendingGoogleProduct() {\n  try { window.localStorage.removeItem(APOIS_GOOGLE_PENDING_KEY); } catch { /* storage indisponível */ }\n}\n\n`;
  source = source.slice(0, index) + helper + source.slice(index);
}

replaceRequired(
  '  const appListenerRef = useRef<PluginListenerHandle | null>(null);\n  const nativeCallback = getNativeAuthCallback();',
  '  const appListenerRef = useRef<PluginListenerHandle | null>(null);\n  const callbackInFlightRef = useRef(false);\n  const nativeCallback = getNativeAuthCallback();',
  'guard de callback concorrente ausente',
);

replaceRequired(
  '  const handleNativeCallback = async (callbackUrl: string) => {\n    if (!callbackUrl.startsWith(nativeCallback)) return;\n\n    try {',
  '  const handleNativeCallback = async (callbackUrl: string) => {\n    if (!callbackUrl.startsWith(nativeCallback) || callbackInFlightRef.current) return;\n    callbackInFlightRef.current = true;\n\n    try {',
  'callback não possui guard de concorrência',
);

replaceRequired(
  '      await appListenerRef.current?.remove();\n      appListenerRef.current = null;\n      const home = getProductHomeRoute();',
  '      await appListenerRef.current?.remove();\n      appListenerRef.current = null;\n      clearPendingGoogleProduct();\n      try { window.localStorage.removeItem(APOIS_GOOGLE_FORWARD_KEY); } catch { /* já consumido */ }\n      const home = getProductHomeRoute();',
  'callback concluído não limpa handoff',
);

replaceRequired(
  '      toast.error(`Não foi possível concluir o acesso com Google: ${message}`);\n      setLoading(false);\n    }\n  };',
  '      toast.error(`Não foi possível concluir o acesso com Google: ${message}`);\n      clearPendingGoogleProduct();\n      setLoading(false);\n    } finally {\n      callbackInFlightRef.current = false;\n    }\n  };',
  'callback com erro não libera guard',
);

if (!source.includes('apois:entregas-google-callback')) {
  const marker = '  const handleGoogleLogin = async () => {';
  const index = source.indexOf(marker);
  if (index < 0) throw new Error('[FAIL] Entregas Google OAuth: função login ausente');
  const effect = `  useEffect(() => {\n    const onForwarded = (event: Event) => {\n      const callbackUrl = (event as CustomEvent<{ url?: string }>).detail?.url;\n      if (typeof callbackUrl === "string") void handleNativeCallback(callbackUrl);\n    };\n    window.addEventListener("apois:entregas-google-callback", onForwarded as EventListener);\n    const forwarded = consumeForwardedGoogleCallback();\n    if (forwarded) void handleNativeCallback(forwarded);\n    return () => window.removeEventListener("apois:entregas-google-callback", onForwarded as EventListener);\n  }, [nativeCallback]);\n\n`;
  source = source.slice(0, index) + effect + source.slice(index);
}

replaceRequired(
  '      const redirectTo = isNative ? nativeCallback : `${window.location.origin}/auth/callback`;\n\n      const { data, error } = await supabase.auth.signInWithOAuth({',
  '      const redirectTo = isNative ? nativeCallback : `${window.location.origin}/auth/callback`;\n      if (isNative) {\n        try {\n          window.localStorage.setItem(APOIS_GOOGLE_PENDING_KEY, JSON.stringify({ product: "entregas", createdAt: Date.now() }));\n        } catch { /* bridge direto ainda pode receber appUrlOpen */ }\n      }\n\n      const { data, error } = await supabase.auth.signInWithOAuth({',
  'marcador de produto não é criado antes do OAuth',
);

replaceRequired(
  '      toast.error(`Não foi possível entrar com Google: ${message}`);\n      setLoading(false);',
  '      toast.error(`Não foi possível entrar com Google: ${message}`);\n      clearPendingGoogleProduct();\n      setLoading(false);',
  'falha ao abrir Google não limpa marcador',
);

for (const marker of [
  'APOIS_GOOGLE_PENDING_KEY',
  'APOIS_GOOGLE_FORWARD_KEY',
  'APOIS_GOOGLE_CALLBACK_TTL_MS',
  'consumeForwardedGoogleCallback',
  'product: "entregas"',
  'apois:entregas-google-callback',
  'callbackInFlightRef',
  'completeNativeGoogleLogin(callbackUrl)',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregas Google OAuth incompleto: ${marker}`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas Google OAuth: callback nativo permanece no próprio módulo, com handoff persistente e sem corrida com a rota genérica.');
