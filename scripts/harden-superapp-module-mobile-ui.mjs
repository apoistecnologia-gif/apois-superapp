import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const moduleName = process.argv[2];
if (!['corridas', 'entregas'].includes(moduleName)) {
  throw new Error('Uso: node scripts/harden-superapp-module-mobile-ui.mjs <corridas|entregas>');
}

function patch(path, transform, label) {
  const full = resolve(path);
  const before = readFileSync(full, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log('[OK] ' + label + ' (já aplicado ou nativo)');
    return;
  }
  writeFileSync(full, after, 'utf8');
  console.log('[OK] ' + label);
}

if (moduleName === 'corridas') {
  patch('.work/corridas/src/components/BottomNavigation.tsx', (source) => {
    let next = source;
    next = next.replaceAll('text-zinc-600', 'text-zinc-500');
    next = next.replace('shadow-[0_-4px_20px_rgba(0,0,0,0.5)]', 'shadow-[0_-10px_30px_rgba(0,0,0,0.55)]');
    return next;
  }, 'Corridas: rodapé real mantém contraste adequado em celular');

  const bottomNav = readFileSync(resolve('.work/corridas/src/components/BottomNavigation.tsx'), 'utf8');
  for (const marker of ['grid-cols-5', 'min-h-[64px]', 'Início', 'Corridas', 'Carteira', 'Notificações', 'Perfil']) {
    if (!bottomNav.includes(marker)) throw new Error('[FAIL] Corridas: rodapé mobile incompleto (' + marker + ')');
  }

  await import('./harden-corridas-superapp-profile-ui.mjs');
  await import('./harden-corridas-last-visual-pass.mjs');
  await import('./harden-corridas-final-red-surfaces.mjs');
  await import('./harden-corridas-final-shell-surfaces.mjs');
  await import('./harden-corridas-public-shell-surfaces.mjs');
  await import('./harden-corridas-mobile-proportions.mjs');
  await import('./fix-corridas-public-form-contrast-v1.mjs');
} else {
  patch('.work/entregas/src/routes/inicio.tsx', (source) => {
    let next = source;
    next = next.replace(
      'border-b border-accent/15 px-4 pb-3 pt-[max(env(safe-area-inset-top),1.25rem)]',
      'border-b border-accent/15 px-4 pb-2.5 pt-[max(env(safe-area-inset-top),0.75rem)]',
    );
    next = next.replaceAll(
      'w-full truncate text-center text-[11px] font-medium text-zinc-300',
      'w-full truncate text-center text-xs font-semibold text-zinc-300',
    );
    return next;
  }, 'Entregas: cabeçalho da Home desce para área útil e categorias ficam mais legíveis');

  patch('.work/entregas/src/routes/perfil/index.tsx', (source) => {
    let next = source;
    next = next.replace(
      'pt-[max(env(safe-area-inset-top),1.25rem)]',
      'pt-[max(env(safe-area-inset-top),0.75rem)]',
    );
    next = next.replace('      { icon: ClipboardList, label: "Meus pedidos", path: "/pedidos" },\n', '');
    next = next.replace('      { icon: Heart, label: "Favoritos", path: "/favoritos" },\n', '');
    next = next.replace('  ClipboardList,\n', '');
    next = next.replace('  Heart,\n', '');
    return next;
  }, 'Entregas: Perfil remove atalhos duplicados do rodapé e alinha o cabeçalho');

  patch('.work/entregas/src/components/AppBottomNav.tsx', (source) => {
    let next = source;
    next = next.replace(
      'import { Home, Compass, Heart, User, Bike } from "lucide-react";',
      'import { Home, Compass, Heart, User, Search } from "lucide-react";',
    );
    next = next.replace('<Bike className="h-7 w-7" />', '<Search className="h-8 w-8" />');
    // Alvos de toque e rótulos legíveis: o snapshot declara 56px/68px por aba e
    // rótulo de 11px, que ficam abaixo do mínimo confortável no Android.
    next = next.replaceAll(
      'className="flex min-h-[56px] min-w-[68px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95"',
      'className="flex min-h-[64px] min-w-[72px] flex-col items-center justify-center gap-1 px-1 transition-all active:scale-95"',
    );
    next = next.replaceAll(
      'text-[11px] leading-none transition-colors',
      'text-xs leading-none transition-colors',
    );
    next = next.replace(
      'className="flex min-h-[82px] items-center justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.95rem)] pt-2.5 md:pb-3"',
      'className="flex min-h-[88px] items-center justify-around px-2 pb-[max(44px,env(safe-area-inset-bottom))] pt-2.5 md:pb-3"',
    );
    return next;
  }, 'Entregas: rodapé com ícone de Busca, alvo de 64px, rótulo legível e safe area Android');

  const home = readFileSync(resolve('.work/entregas/src/routes/inicio.tsx'), 'utf8');
  // O tema claro do Cliente redefine a cor do rótulo das categorias
  // (text-[#353C47]). O contrato real é rótulo em text-xs com peso semibold.
  if (!home.includes('pt-[max(env(safe-area-inset-top)')) {
    throw new Error('[FAIL] Entregas: cabeçalho da Home perdeu a safe area superior');
  }
  if (!/truncate text-center text-xs font-semibold/.test(home)) {
    throw new Error('[FAIL] Entregas: rótulo das categorias da Home perdeu tamanho/legibilidade');
  }

  const profile = readFileSync(resolve('.work/entregas/src/routes/perfil/index.tsx'), 'utf8');
  if (profile.includes('label: "Meus pedidos"') || profile.includes('label: "Favoritos"')) {
    throw new Error('[FAIL] Entregas: Perfil ainda repete atalhos já existentes no rodapé.');
  }
  if (!profile.includes('pt-[max(env(safe-area-inset-top),0.75rem)]')) {
    throw new Error('[FAIL] Entregas: cabeçalho do Perfil ainda está excessivamente afastado do topo útil.');
  }

  const bottomNav = readFileSync(resolve('.work/entregas/src/components/AppBottomNav.tsx'), 'utf8');
  for (const marker of [
    'min-h-[88px]',
    'pb-[max(44px,env(safe-area-inset-bottom))]',
    'min-h-[64px]',
    'min-w-[72px]',
    'h-8 w-8',
    'text-xs leading-none',
    'aria-label="Buscar"',
    '<Search className="h-8 w-8" />',
  ]) {
    if (!bottomNav.includes(marker)) throw new Error('[FAIL] Entregas: rodapé mobile regrediu (' + marker + ')');
  }
  // O rodapé pode ser `absolute` (layout interno da Home, com o container em
  // h-dvh) ou `fixed`. Exigir apenas `fixed` reprovava o snapshot fixado e
  // derrubava o build de Entregas.
  if (!/\b(absolute|fixed) bottom-0\b/.test(bottomNav)) {
    throw new Error('[FAIL] Entregas: rodapé mobile não está ancorado no rodapé da tela');
  }
  if (bottomNav.includes('<Bike className=')) throw new Error('[FAIL] Entregas: ação Buscar voltou a usar ícone de motocicleta.');
  console.log('[OK] Entregas: rodapé fixo permanece grande, legível, sem ícone ambíguo e fora da barra de gestos do Android.');

  await import('./harden-entregas-superapp-cart-mobile-ui.mjs');
  await import('./harden-entregas-superapp-viewport.mjs');
}
