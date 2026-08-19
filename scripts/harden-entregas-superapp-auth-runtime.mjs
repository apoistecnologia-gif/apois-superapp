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

replaceRequired(
  '.work/entregas/src/lib/customer-push.ts',
  '        const target = notificationTarget(action.notification);\n        if (window.location.pathname !== target) window.location.assign(target);',
  '        const target = notificationTarget(action.notification);\n        const targetHash = `#${target}`;\n        if (window.location.hash !== targetHash) window.location.replace(targetHash);',
  'entregas: toque em push navega por Hash History sem sair da pasta aninhada do Superapp',
);

replaceRequired(
  '.work/entregas/src/components/AppBottomNav.tsx',
  '<nav className="absolute bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-xl">',
  '<nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-xl">',
  'entregas: rodapé do cliente permanece visível durante rolagem',
);

replaceRequired(
  '.work/entregas/src/components/AppBottomNav.tsx',
  '<div className="flex min-h-[82px] items-center justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.95rem)] pt-2.5 md:pb-3">',
  '<div className="flex min-h-[88px] items-center justify-around px-2 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-2.5 md:pb-4">',
  'entregas: rodapé ganha área de toque e safe-area inferior confortáveis',
);

replaceRequired(
  '.work/entregas/src/components/AppBottomNav.tsx',
  'className="apois-customer-soft-glow grid h-16 w-16 place-items-center rounded-full border border-primary/35 bg-primary text-white ring-4 ring-background transition-transform active:scale-90"',
  'className="apois-customer-soft-glow grid h-[68px] w-[68px] place-items-center rounded-full border border-primary/35 bg-primary text-white ring-4 ring-background transition-transform active:scale-90"',
  'entregas: ação central do rodapé fica mais legível',
);

replaceRequired(
  '.work/entregas/src/components/AppBottomNav.tsx',
  'className={`h-7 w-7 transition-colors ${active ? "text-primary" : "text-zinc-500"}`}',
  'className={`h-8 w-8 transition-colors ${active ? "text-primary" : "text-zinc-500"}`}',
  'entregas: ícones do rodapé ficam maiores',
);

replaceRequired(
  '.work/entregas/src/components/AppBottomNav.tsx',
  'className="flex min-h-[56px] min-w-[68px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95"',
  'className="flex min-h-[64px] min-w-[72px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95"',
  'entregas: botões do rodapé ganham alvo de toque maior',
);

replaceRequired(
  '.work/entregas/src/components/AppBottomNav.tsx',
  'className={`text-[11px] leading-none transition-colors ${active ? "font-bold text-primary" : "font-medium text-zinc-500"}`}',
  'className={`text-xs leading-none transition-colors ${active ? "font-bold text-primary" : "font-medium text-zinc-500"}`}',
  'entregas: rótulos do rodapé ficam legíveis',
);

replaceRequired(
  '.work/entregas/src/routes/inicio.tsx',
  '<main className="scrollbar-none flex-1 space-y-4 overflow-y-auto px-4 pb-20 pt-5">',
  '<main className="scrollbar-none flex-1 space-y-4 overflow-y-auto px-4 pb-32 pt-5">',
  'entregas: conteúdo da Home não fica escondido atrás do rodapé',
);

replaceRequired(
  '.work/entregas/src/routes/pedidos.tsx',
  '<main className="scrollbar-none flex-1 space-y-4 overflow-y-auto p-4 pb-24">',
  '<main className="scrollbar-none flex-1 space-y-4 overflow-y-auto p-4 pb-32">',
  'entregas: lista de pedidos reserva espaço para o rodapé fixo',
);

replaceRequired(
  '.work/entregas/src/routes/perfil/index.tsx',
  '<main className="scrollbar-none flex-1 overflow-y-auto p-4 pb-20 pt-5">',
  '<main className="scrollbar-none flex-1 overflow-y-auto p-4 pb-32 pt-5">',
  'entregas: perfil reserva espaço para o rodapé fixo',
);

replaceRequired(
  '.work/entregas/src/routes/checkout.tsx',
  '  const paymentMethod =\n    typeof window !== "undefined" ? sessionStorage.getItem("apois_payment_method") || "pix" : "pix";',
  '  const paymentMethod = "pix";',
  'entregas: checkout ignora método legado em storage e aceita somente PIX',
);

console.log('[OK] entregas: OAuth, sessão Hash, e-mail, Push, rodapé e PIX-only respeitam o Superapp sem alterar o app original');
