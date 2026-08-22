import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve('.work/entregas');

function read(relativePath) {
  const path = resolve(workspace, relativePath);
  return { path, source: readFileSync(path, 'utf8') };
}

function write(state, label) {
  writeFileSync(state.path, state.source, 'utf8');
  console.log(`[OK] ${label}`);
}

function ensureProfileNav(relativePath, label) {
  const state = read(relativePath);
  let source = state.source;

  if (!source.includes('import { AppBottomNav } from "@/components/AppBottomNav";')) {
    const anchor = 'import { supabase } from "@/integrations/supabase/client";';
    if (!source.includes(anchor)) throw new Error(`[FAIL] ${label}: import Supabase não encontrado`);
    source = source.replace(anchor, `${anchor}\nimport { AppBottomNav } from "@/components/AppBottomNav";`);
  }

  source = source.replace(
    /<header className="([^"]*)">/,
    (_match, classes) => {
      let next = String(classes)
        .replace(/\bp-4\b/g, 'px-4 pb-3')
        .replace(/\bpt-8\b/g, '')
        .replace(/\bpt-\[max\(env\(safe-area-inset-top\),[^\]]+\)\]\b/g, '');
      next = `${next} pt-[max(env(safe-area-inset-top),0.85rem)]`.replace(/\s+/g, ' ').trim();
      return `<header className="${next}">`;
    },
  );

  source = source.replace(
    /<main className="([^"]*)">/,
    (_match, classes) => {
      let next = String(classes)
        .replace(/\bp-6\b/g, 'px-4 sm:px-6')
        .replace(/\bpb-\d+\b/g, '')
        .replace(/\bpt-\d+\b/g, '');
      next = `${next} pb-32 pt-5`.replace(/\s+/g, ' ').trim();
      return `<main className="${next}">`;
    },
  );

  if (!source.includes('<AppBottomNav activeTab="perfil" />')) {
    const closing = '\n    </div>\n  );\n}';
    const index = source.lastIndexOf(closing);
    if (index < 0) throw new Error(`[FAIL] ${label}: fechamento da página não encontrado`);
    source = `${source.slice(0, index)}\n      <AppBottomNav activeTab="perfil" />${source.slice(index)}`;
  }

  state.source = source;
  write(state, `${label}: rodapé e safe-area estabilizados`);
}

for (const [path, label] of [
  ['src/routes/perfil/notificacoes.tsx', 'Entregas Notificações'],
  ['src/routes/perfil/legal.tsx', 'Entregas Legal'],
  ['src/routes/perfil/ajuda.tsx', 'Entregas Ajuda'],
]) {
  ensureProfileNav(path, label);
}

{
  const state = read('src/routes/perfil/ajuda.tsx');
  if (!state.source.includes('max-h-[calc(100dvh-max(env(safe-area-inset-top),1rem))]')) {
    state.source = state.source.replace(
      /className="w-full rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:max-w-lg sm:rounded-3xl"/,
      'className="max-h-[calc(100dvh-max(env(safe-area-inset-top),1rem))] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-5 sm:max-w-lg sm:rounded-3xl"',
    );
  }
  if (!state.source.includes('max-h-[calc(100dvh-max(env(safe-area-inset-top),1rem))]')) {
    throw new Error('[FAIL] Entregas Ajuda: formulário inferior não recebeu viewport móvel segura');
  }
  write(state, 'Entregas Ajuda: formulário móvel estabilizado');
}

// Endereços pode chegar aqui já parcialmente alterado por hardeners anteriores.
// Normalize por contrato sem depender de uma classe exata da fonte protegida.
{
  const state = read('src/routes/enderecos.tsx');
  let source = state.source;

  if (!source.includes('import { AppBottomNav } from "@/components/AppBottomNav";')) {
    const anchor = 'import { Button } from "@/components/ui/button";';
    if (!source.includes(anchor)) throw new Error('[FAIL] Entregas Endereços: import de Button não encontrado');
    source = source.replace(anchor, `${anchor}\nimport { AppBottomNav } from "@/components/AppBottomNav";`);
  }

  source = source.replace(
    /<header className="([^"]*)">/,
    (_match, classes) => {
      let next = String(classes)
        .replace(/\bpt-8\b/g, '')
        .replace(/\bpb-4\b/g, 'pb-3')
        .replace(/\bpt-\[max\(env\(safe-area-inset-top\),[^\]]+\)\]\b/g, '');
      next = `${next} pt-[max(env(safe-area-inset-top),0.85rem)]`.replace(/\s+/g, ' ').trim();
      return `<header className="${next}">`;
    },
  );

  if (!source.includes('<AppBottomNav activeTab="perfil" />')) {
    if (!source.includes('<Outlet />')) throw new Error('[FAIL] Entregas Endereços: Outlet não encontrado');
    source = source.replace('<Outlet />', '<Outlet />\n      <AppBottomNav activeTab="perfil" />');
  }

  if (!source.includes('pb-32')) {
    source = source.replace(/<main className="([^"]*)">/, (_match, classes) => {
      const next = `${String(classes)} pb-32`.replace(/\s+/g, ' ').trim();
      return `<main className="${next}">`;
    });
  }

  if (
    !source.includes('import { AppBottomNav } from "@/components/AppBottomNav";') ||
    !source.includes('<AppBottomNav activeTab="perfil" />') ||
    !source.includes('pb-32') ||
    !source.includes('pt-[max(env(safe-area-inset-top),0.85rem)]')
  ) {
    throw new Error('[FAIL] Entregas Endereços: contrato móvel não estabilizado');
  }

  state.source = source;
  write(state, 'Entregas Endereços: rodapé e safe-area estabilizados');
}

// Estabelecimento também é preparado aqui para evitar que a etapa secundária
// dependa de classes literais que podem ter sido alteradas por branding/touch hardeners.
{
  const state = read('src/routes/estabelecimento.$merchantId.tsx');
  let source = state.source;

  if (!source.includes('import { AppBottomNav } from "@/components/AppBottomNav";')) {
    const anchor = 'import { ProductCustomizationSheet } from "@/components/ProductCustomizationSheet";';
    if (!source.includes(anchor)) throw new Error('[FAIL] Entregas Estabelecimento: import de ProductCustomizationSheet não encontrado');
    source = source.replace(anchor, `${anchor}\nimport { AppBottomNav } from "@/components/AppBottomNav";`);
  }

  source = source.replaceAll('onClick={() => window.history.back()}', 'onClick={() => void navigate({ to: "/inicio", replace: true })}');
  source = source.replace(
    /className="absolute left-0 right-0 top-0 flex items-center justify-between [^"]*"/,
    'className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 pb-4 pt-[max(env(safe-area-inset-top),0.85rem)]"',
  );
  source = source.replaceAll('grid h-10 w-10 place-items-center rounded-full bg-black/40', 'grid h-11 w-11 place-items-center rounded-full bg-black/40');
  source = source.replaceAll('grid h-10 w-10 place-items-center rounded-full border border-primary/20 bg-primary/5', 'grid h-12 w-12 place-items-center rounded-full border border-primary/20 bg-primary/5');
  source = source.replaceAll('className="sticky bottom-4 left-0 right-0 z-50 px-4"', 'className="sticky bottom-[calc(7rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-4"');

  if (!source.includes('<AppBottomNav activeTab="inicio" />')) {
    if (source.includes('<div className="h-10 shrink-0" />')) {
      source = source.replace('<div className="h-10 shrink-0" />', '<div className="h-32 shrink-0" />\n      <AppBottomNav activeTab="inicio" />');
    } else {
      const closing = '\n    </div>\n  );\n}';
      const index = source.lastIndexOf(closing);
      if (index < 0) throw new Error('[FAIL] Entregas Estabelecimento: fechamento principal não encontrado');
      source = `${source.slice(0, index)}\n      <div className="h-32 shrink-0" />\n      <AppBottomNav activeTab="inicio" />${source.slice(index)}`;
    }
  }

  if (!source.includes('h-32 shrink-0')) {
    source = source.replace('<AppBottomNav activeTab="inicio" />', '<div className="h-32 shrink-0" />\n      <AppBottomNav activeTab="inicio" />');
  }

  if (
    !source.includes('<AppBottomNav activeTab="inicio" />') ||
    !source.includes('pt-[max(env(safe-area-inset-top),0.85rem)]') ||
    source.includes('window.history.back()')
  ) {
    throw new Error('[FAIL] Entregas Estabelecimento: contrato móvel não estabilizado');
  }

  state.source = source;
  write(state, 'Entregas Estabelecimento: navegação, safe-area e retorno estabilizados');
}
