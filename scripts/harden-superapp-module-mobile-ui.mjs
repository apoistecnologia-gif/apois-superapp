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
  if (after === before) throw new Error(`[FAIL] ${label}: nenhum ajuste aplicado em ${path}`);
  writeFileSync(full, after, 'utf8');
  console.log(`[OK] ${label}`);
}

if (moduleName === 'corridas') {
  patch('.work/corridas/src/components/layout/AppShell.tsx', (source) => {
    let next = source;
    next = next.replaceAll(
      '"app-pressable flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[9px] font-bold"',
      '"app-pressable flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[11px] font-bold leading-none"',
    );
    next = next.replaceAll('<Icon size={21} />', '<Icon size={24} strokeWidth={2.2} />');
    next = next.replace(
      'className="app-safe-x shrink-0 border-t border-white/10 bg-black/98 pt-2 shadow-[0_-12px_30px_rgba(0,0,0,.55)]"',
      'className="app-safe-x shrink-0 border-t border-white/10 bg-black/98 pt-2.5 shadow-[0_-12px_30px_rgba(0,0,0,.55)]"',
    );
    return next;
  }, 'Corridas: rodapé global ganha alvos de toque e textos legíveis em celular');

  const appShell = readFileSync(resolve('.work/corridas/src/components/layout/AppShell.tsx'), 'utf8');
  for (const marker of ['min-h-[64px]', 'text-[11px]', '<Icon size={24} strokeWidth={2.2} />', 'pt-2.5']) {
    if (!appShell.includes(marker)) throw new Error(`[FAIL] Corridas: rodapé mobile incompleto (${marker})`);
  }
  if (appShell.includes('MainHamburgerMenu')) {
    throw new Error('[FAIL] Corridas: menu hambúrguer duplicado voltou ao AppShell.');
  }

  await import('./harden-corridas-superapp-profile-ui.mjs');
}

if (moduleName === 'entregas') {
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

  const home = readFileSync(resolve('.work/entregas/src/routes/inicio.tsx'), 'utf8');
  for (const marker of ['pt-[max(env(safe-area-inset-top),0.75rem)]', 'pb-2.5', 'text-xs font-semibold text-zinc-300']) {
    if (!home.includes(marker)) throw new Error(`[FAIL] Entregas: ajuste visual da Home incompleto (${marker})`);
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
  ]) {
    if (!bottomNav.includes(marker)) throw new Error(`[FAIL] Entregas: rodapé mobile regrediu (${marker})`);
  }
  console.log('[OK] Entregas: rodapé fixo permanece grande, legível e fora da barra de gestos do Android.');
}
