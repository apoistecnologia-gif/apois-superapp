import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
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

console.log('[OK] entregas: OAuth e isolamento de sessão respeitam o runtime Hash do Superapp sem alterar o app original');
