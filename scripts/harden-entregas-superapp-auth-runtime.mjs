import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement));
  console.log(`[OK] ${label}`);
}

replaceRequired(
  '.work/entregas/src/components/GoogleLoginButton.tsx',
  '        if (!appListenerRef.current) {\n          appListenerRef.current = await App.addListener("appUrlOpen", ({ url }) => {\n            void handleNativeCallback(url);\n          });\n        }\n\n        await Browser.open({ url: data.url });',
  '        const superappBridgeActive = Boolean(\n          (window as Window & { __APOIS_SUPERAPP_AUTH_BRIDGE__?: boolean }).__APOIS_SUPERAPP_AUTH_BRIDGE__,\n        );\n        if (!superappBridgeActive && !appListenerRef.current) {\n          appListenerRef.current = await App.addListener("appUrlOpen", ({ url }) => {\n            void handleNativeCallback(url);\n          });\n        }\n\n        await Browser.open({ url: data.url });',
  'entregas: OAuth nativo evita listener duplicado quando bridge do Superapp está ativo',
);

replaceRequired(
  '.work/entregas/src/components/AuthSessionIsolation.tsx',
  '    const currentPath = window.location.pathname || "/";\n\n    if (!isPathAllowedForProduct(currentPath, product)) {\n      window.location.replace(getProductLandingRoute(product));',
  '    const hashPath = window.location.hash.startsWith("#/")\n      ? window.location.hash.slice(1).split(/[?#]/, 1)[0] || "/"\n      : null;\n    const currentPath = hashPath || window.location.pathname || "/";\n\n    if (!isPathAllowedForProduct(currentPath, product)) {\n      window.location.replace(`#${getProductLandingRoute(product)}`);',
  'entregas: isolamento de sessão valida a rota Hash do módulo em vez do caminho físico do Superapp',
);

replaceRequired(
  '.work/entregas/src/routes/perfil/dados-pessoais.tsx',
  '          { email: requestedEmail },\n          { emailRedirectTo: `${window.location.origin}/perfil/dados-pessoais` },',
  '          { email: requestedEmail },\n          { emailRedirectTo: "br.com.apois.app://auth/email-change" },',
  'entregas: confirmação de troca de e-mail retorna ao package unificado',
);

replaceRequired(
  '.work/entregas/src/lib/customer-push.ts',
  '    _platform: "android",\n  });',
  '    _platform: "android",\n    _app_package: "br.com.apois.app",\n  });',
  'entregas: registro FCM declara explicitamente o package unificado',
);

replaceRequired(
  '.work/entregas/src/lib/customer-push.ts',
  '      const { error } = await (supabase.rpc as any)("remove_superapp_customer_push_devices");',
  '      const { error } = await (supabase.rpc as any)("remove_superapp_customer_push_devices", {\n        _app_package: "br.com.apois.app",\n      });',
  'entregas: logout remove somente dispositivos do package unificado',
);

console.log('[OK] entregas: OAuth, sessão Hash, e-mail e Push respeitam o Superapp sem alterar o app original');
