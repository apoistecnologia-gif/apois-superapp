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
    return next;
  }, 'Entregas: ação central do rodapé usa ícone de Busca em vez de motocicleta ambígua');

  const home = readFileSync(resolve('.work/entregas/src/routes/inicio.tsx'), 'utf8');
  for (const marker of ['pt-[max(env(safe-area-inset-top),0.75rem)]', 'pb-2.5', 'text-xs font-semibold text-zinc-300']) {
    if (!home.includes(marker)) throw new Error('[FAIL] Entregas: ajuste visual da Home incompleto (' + marker + ')');
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
    'fixed bottom-0',
    'min-h-[88px]',
    'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
    'min-h-[64px]',
    'min-w-[72px]',
    'h-8 w-8',
    'text-xs leading-none',
    'aria-label="Buscar"',
    '<Search className="h-8 w-8" />',
  ]) {
    if (!bottomNav.includes(marker)) throw new Error('[FAIL] Entregas: rodapé mobile regrediu (' + marker + ')');
  }
  if (bottomNav.includes('<Bike className=')) throw new Error('[FAIL] Entregas: ação Buscar voltou a usar ícone de motocicleta.');
  console.log('[OK] Entregas: rodapé fixo permanece grande, legível, sem ícone ambíguo e fora da barra de gestos do Android.');

  await import('./harden-entregas-superapp-cart-mobile-ui.mjs');
  await import('./harden-entregas-superapp-viewport.mjs');
}
