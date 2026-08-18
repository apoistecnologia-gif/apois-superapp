import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const name = process.argv[2];

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  const after = before.replace(search, replacement);
  writeFileSync(full, after);
  console.log(`[OK] ${label}`);
}

if (name === 'corridas') {
  // Corridas já usa Hash History e base relativa no snapshot protegido.
  console.log('[OK] corridas: createHashHistory + base relativa já são nativos do módulo');
  process.exit(0);
}

if (name === 'entregas') {
  replaceRequired(
    '.work/entregas/src/router.tsx',
    'import { createRouter } from "@tanstack/react-router";',
    'import { createRouter, createHashHistory } from "@tanstack/react-router";',
    'entregas: importar createHashHistory',
  );
  replaceRequired(
    '.work/entregas/src/router.tsx',
    '  const router = createRouter({\n    routeTree,',
    '  const hashHistory = typeof window !== "undefined" ? createHashHistory() : undefined;\n\n  const router = createRouter({\n    routeTree,\n    ...(hashHistory ? { history: hashHistory } : {}),',
    'entregas: usar Hash History apenas no WebView/browser',
  );
  replaceRequired(
    '.work/entregas/vite.config.ts',
    'export default defineConfig({\n',
    'export default defineConfig({\n  vite: { base: "./" },\n',
    'entregas: gerar assets com caminhos relativos',
  );
  replaceRequired(
    '.work/entregas/src/routes/index.tsx',
    'src="/apois-logo.svg"',
    'src="./apois-logo.svg"',
    'entregas: logo principal relativa ao módulo',
  );
  replaceRequired(
    '.work/entregas/src/components/ApoisLaunchSplash.tsx',
    'src="/apois-app-icon.png"',
    'src="./apois-app-icon.png"',
    'entregas: ícone do splash relativo ao módulo',
  );
  replaceRequired(
    '.work/entregas/src/components/GoogleLoginButton.tsx',
    'const CUSTOMER_OAUTH_CALLBACK = "br.com.apois.cliente://auth/callback";',
    'const CUSTOMER_OAUTH_CALLBACK = "br.com.apois.app://auth/callback";',
    'entregas: callback Google usa package unificado',
  );
  replaceRequired(
    '.work/entregas/src/components/GoogleLoginButton.tsx',
    '      window.location.replace("/inicio");',
    '      window.location.replace("#/inicio");',
    'entregas: pós-login Google respeita Hash History do Superapp',
  );
  replaceRequired(
    '.work/entregas/src/lib/customer-push.ts',
    'export function isNativeCustomerAndroid() {\n  return (\n    getApoisProductMode() === "customer" &&\n    Capacitor.isNativePlatform() &&\n    Capacitor.getPlatform() === "android"\n  );\n}',
    'export function isNativeCustomerAndroid() {\n  const superappPushEnabled = import.meta.env["VITE_APOIS_SUPERAPP_PUSH_ENABLED"] !== "0";\n  return (\n    superappPushEnabled &&\n    getApoisProductMode() === "customer" &&\n    Capacitor.isNativePlatform() &&\n    Capacitor.getPlatform() === "android"\n  );\n}',
    'entregas: push só inicializa quando Firebase do Superapp estiver pronto',
  );
  replaceRequired(
    '.work/entregas/src/lib/customer-push.ts',
    '    ? `/pedido/${encodeURIComponent(orderId)}`\n    : "/notificacoes";',
    '    ? `#/pedido/${encodeURIComponent(orderId)}`\n    : "#/notificacoes";',
    'entregas: push abre rotas compatíveis com Hash History',
  );
  replaceRequired(
    '.work/entregas/src/lib/customer-push.ts',
    '        if (window.location.pathname !== target) window.location.assign(target);',
    '        if (window.location.hash !== target) window.location.assign(target);',
    'entregas: navegação de push compara hash no Superapp',
  );
  process.exit(0);
}

console.error(`Módulo desconhecido: ${name}`);
process.exit(1);
