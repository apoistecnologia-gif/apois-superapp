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
