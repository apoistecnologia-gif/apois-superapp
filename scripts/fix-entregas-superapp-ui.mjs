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
  'className="h-7 w-7 transition-colors ${active ? "text-primary" : "text-zinc-500"}"',
  'className="h-8 w-8 transition-colors ${active ? "text-primary" : "text-zinc-500"}"',
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
  '.work/entregas/src/routes/checkout.tsx',
  '  const paymentMethod =\n    typeof window !== "undefined" ? sessionStorage.getItem("apois_payment_method") || "pix" : "pix";',
  '  const paymentMethod = "pix";',
  'entregas: checkout ignora método legado em storage e aceita somente PIX',
);

console.log('[OK] entregas: UI do cliente e regra PIX-only adaptadas somente na cópia do Superapp');
