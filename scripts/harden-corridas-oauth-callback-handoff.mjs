import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/components/auth/PassengerGoogleLoginButton.tsx');
let source = readFileSync(path, 'utf8');

function replaceRequired(search, replacement, label) {
  if (source.includes(replacement)) return;
  if (!source.includes(search)) throw new Error(`[FAIL] OAuth Corridas: ${label}`);
  source = source.replace(search, replacement);
}

replaceRequired(
  'import { useEffect, useRef, useState } from "react";',
  'import { useCallback, useEffect, useRef, useState } from "react";',
  'imports do componente mudaram',
);
replaceRequired(
  'import { App, type PluginListenerHandle } from "@capacitor/app";\nimport { Capacitor } from "@capacitor/core";',
  'import { App } from "@capacitor/app";\nimport { Capacitor, type PluginListenerHandle } from "@capacitor/core";',
  'tipo PluginListenerHandle está no pacote incorreto',
);
replaceRequired(
  'const PENDING_PRODUCT_KEY = "apois-superapp:pending-oauth-product";',
  'const PENDING_PRODUCT_KEY = "apois-superapp:pending-oauth-product";\nconst CALLBACK_TTL_MS = 120_000;',
  'chave de produto pendente ausente',
);
replaceRequired(
  '  try { window.localStorage.removeItem(PENDING_PRODUCT_KEY); } catch {}',
  '  try { window.localStorage.removeItem(PENDING_PRODUCT_KEY); } catch { /* storage pode estar indisponível */ }',
  'cleanup do produto pendente mudou',
);
replaceRequired(
  `function browserPlugin() {\n  return (window as any).Capacitor?.Plugins?.Browser;\n}`,
  `type BrowserBridge = {\n  open?: (options: { url: string }) => Promise<void>;\n  close?: () => Promise<void>;\n  addListener?: (eventName: "browserFinished", listener: () => void) => Promise<{ remove: () => Promise<void> }>;\n};\n\nfunction browserPlugin(): BrowserBridge | undefined {\n  const nativeWindow = window as Window & { Capacitor?: { Plugins?: { Browser?: BrowserBridge } } };\n  return nativeWindow.Capacitor?.Plugins?.Browser;\n}`,
  'bridge Browser sem any mudou',
);
replaceRequired(
  `function isCorridasCallback(rawUrl: string) {\n  return rawUrl.startsWith(CALLBACK) || rawUrl.startsWith(LEGACY_CALLBACK);\n}`,
  `function isCorridasCallback(rawUrl: string) {\n  try {\n    const url = new URL(rawUrl);\n    return url.protocol === "br.com.apois.app:" && url.hostname === "auth" &&\n      (url.pathname === "/callback" || url.pathname === "/corridas-google");\n  } catch {\n    return false;\n  }\n}`,
  'validação inicial da URI de callback mudou',
);
replaceRequired(
  `function isCorridasCallback(rawUrl: string) {\n  try {\n    const url = new URL(rawUrl);\n    return url.protocol === "br.com.apois.app:" && url.hostname === "auth" &&\n      (url.pathname === "/callback" || url.pathname === "/corridas-google");\n  } catch {\n    return false;\n  }\n}`,
  `function isCorridasCallback(rawUrl: string) {\n  try {\n    const url = new URL(rawUrl);\n    return [CALLBACK, LEGACY_CALLBACK].some((expected) => {\n      const target = new URL(expected);\n      return url.protocol === target.protocol && url.hostname === target.hostname && url.pathname === target.pathname;\n    });\n  } catch {\n    return false;\n  }\n}`,
  'validação exata da URI de callback mudou',
);

const paramsMarker = 'function paramsFrom(rawUrl: string) {';
const componentMarker = 'export function PassengerGoogleLoginButton() {';
if (!source.includes('function consumeForwardedCallback()')) {
  const componentIndex = source.indexOf(componentMarker);
  if (componentIndex < 0 || !source.includes(paramsMarker)) throw new Error('[FAIL] OAuth Corridas: parser/callback ausente');
  const helper = `function consumeForwardedCallback() {\n  let stored: string | null = null;\n  try {\n    stored = window.localStorage.getItem(FORWARDED_KEY);\n    window.localStorage.removeItem(FORWARDED_KEY);\n  } catch {\n    return null;\n  }\n  if (!stored) return null;\n  try {\n    const envelope = JSON.parse(stored) as { url?: unknown; createdAt?: unknown };\n    if (typeof envelope.url !== "string" || typeof envelope.createdAt !== "number") return null;\n    const age = Date.now() - envelope.createdAt;\n    if (age < 0 || age > CALLBACK_TTL_MS || !isCorridasCallback(envelope.url)) return null;\n    const params = paramsFrom(envelope.url);\n    if (!params.get("code") || params.has("access_token") || params.has("refresh_token")) return null;\n    return envelope.url;\n  } catch {\n    return null;\n  }\n}\n\n`;
  source = source.slice(0, componentIndex) + helper + source.slice(componentIndex);
}

replaceRequired('  const finish = async (rawUrl: string) => {', '  const finish = useCallback(async (rawUrl: string) => {', 'finish mudou');
replaceRequired(
  `    const code = params.get("code");\n    if (code) {\n      const { error } = await supabase.auth.exchangeCodeForSession(code);\n      if (error) throw error;\n    } else {\n      const accessToken = params.get("access_token");\n      const refreshToken = params.get("refresh_token");\n      if (!accessToken || !refreshToken) throw new Error("google_callback_without_session");\n      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });\n      if (error) throw error;\n    }`,
  `    if (params.has("access_token") || params.has("refresh_token")) throw new Error("google_callback_tokens_rejected");\n    const code = params.get("code");\n    if (!code) throw new Error("google_callback_without_code");\n    const { error } = await supabase.auth.exchangeCodeForSession(code);\n    if (error) throw error;`,
  'fallback de tokens do fluxo implícito ainda estava ativo',
);
replaceRequired('    try { window.localStorage.removeItem(FORWARDED_KEY); } catch {}', '    try { window.localStorage.removeItem(FORWARDED_KEY); } catch { /* callback já consumido */ }', 'cleanup do callback mudou');
replaceRequired('  };\n\n  const handle = async (rawUrl: string) => {', '  }, []);\n\n  const handle = useCallback(async (rawUrl: string) => {', 'limite finish/handle mudou');
replaceRequired('  };\n\n  useEffect(() => {', '  }, [finish]);\n\n  useEffect(() => {', 'limite handle/effect mudou');
replaceRequired(
  `      try {\n        const forwarded = window.localStorage.getItem(FORWARDED_KEY);\n        if (forwarded) {\n          window.localStorage.removeItem(FORWARDED_KEY);\n          if (alive) void handle(forwarded);\n        }\n      } catch {}`,
  `      const forwarded = consumeForwardedCallback();\n      if (forwarded && alive) void handle(forwarded);`,
  'consumo legado do callback mudou',
);
replaceRequired('  }, []);\n\n  const login = async () => {', '  }, [handle]);\n\n  const login = async () => {', 'dependência do listener mudou');
replaceRequired(
  '        try { window.localStorage.setItem(PENDING_PRODUCT_KEY, "corridas"); } catch {}',
  '        try { window.localStorage.setItem(PENDING_PRODUCT_KEY, JSON.stringify({ product: "corridas", createdAt: Date.now() })); } catch { /* appUrlOpen direto permanece disponível */ }',
  'marcador OAuth pendente mudou',
);

for (const marker of ['CALLBACK_TTL_MS', 'consumeForwardedCallback', 'google_callback_tokens_rejected', '[CALLBACK, LEGACY_CALLBACK].some', '}, [handle]);']) {
  if (!source.includes(marker)) throw new Error(`[FAIL] OAuth Corridas incompleto: ${marker}`);
}
writeFileSync(path, source, 'utf8');
console.log('[OK] Corridas OAuth: callback PKCE possui TTL, consumo único, rejeição de tokens e listeners estáveis');
