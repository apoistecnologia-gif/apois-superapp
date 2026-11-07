import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function load(relative) {
  const path = resolve(relative);
  return { path, source: readFileSync(path, 'utf8') };
}

function ensureImport(state) {
  if (state.source.includes('import { AppBottomNav } from "@/components/AppBottomNav";')) return;
  const firstImport = state.source.indexOf('import ');
  if (firstImport !== 0) throw new Error(`${state.path}: início dos imports não encontrado`);
  state.source = `import { AppBottomNav } from "@/components/AppBottomNav";\n${state.source}`;
}

function ensureFooter(state) {
  if (state.source.includes('<AppBottomNav activeTab="perfil" />')) return;
  const closing = '\n    </div>\n  );\n}';
  const index = state.source.lastIndexOf(closing);
  if (index < 0) throw new Error(`${state.path}: fechamento da página não encontrado`);
  state.source = `${state.source.slice(0, index)}\n      <AppBottomNav activeTab="perfil" />${state.source.slice(index)}`;
}

// Quando o snapshot já reserva a safe area por conta própria (o hardener de
// viewport aplica `pt-[max(env(safe-area-inset-top),…)]` em outro valor), a
// troca exata falha sem que exista defeito. Nesse caso aceitamos qualquer
// header que já contenha a expressão de safe area.
function replaceRequired(state, search, replacement, label) {
  if (state.source.includes(replacement)) return;
  if (state.source.includes(search)) {
    state.source = state.source.replace(search, replacement);
    return;
  }
  if (label.endsWith('safe area superior') && state.source.includes('pt-[max(env(safe-area-inset-top)')) {
    return;
  }
  // Reserva inferior: qualquer pb-3x ou safe-area já cumpre o objetivo de não
  // deixar o último item escondido atrás do rodapé.
  if (label.endsWith('reserva inferior')) {
    const scroll = state.source.match(/className="scrollbar-none flex-1[^"]*overflow-y-auto[^"]*"/);
    if (scroll && /pb-(3[0-9]|\[max\(|\[calc\()/.test(scroll[0])) return;
  }
  throw new Error(`${label}: padrão esperado não encontrado`);
}

function finish(state, label) {
  writeFileSync(state.path, state.source, 'utf8');
  console.log(`[OK] ${label}`);
}

{
  const state = load('.work/entregas/src/routes/perfil/pagamentos.tsx');
  ensureImport(state);
  ensureFooter(state);
  replaceRequired(
    state,
    'className="scrollbar-none flex-1 space-y-8 overflow-y-auto p-6 pb-10"',
    'className="scrollbar-none flex-1 space-y-8 overflow-y-auto p-6 pb-32"',
    'Pagamentos: reserva inferior',
  );
  replaceRequired(
    state,
    'No momento, o checkout da APOIS ENTREGA aceita apenas PIX. A cobrança é criada pelo\n              provedor de pagamentos integrado e o pedido só avança após a confirmação do pagamento.',
    'No momento, o checkout registra pagamento direto ao estabelecimento. A APOIS não processa nem\n              confirma esse pagamento eletronicamente.',
    'Pagamentos: texto público alinhado ao pagamento direto',
  );
  finish(state, 'Entregas: Pagamentos mantém rodapé e texto de pagamento direto');
}

{
  const state = load('.work/entregas/src/routes/perfil/notificacoes.tsx');
  ensureImport(state);
  ensureFooter(state);
  replaceRequired(
    state,
    'className="z-50 flex shrink-0 items-center justify-between border-b border-zinc-900 bg-black/80 p-4 backdrop-blur-lg"',
    'className="z-50 flex shrink-0 items-center justify-between border-b border-zinc-900 bg-black/80 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-lg"',
    'Notificações: safe area superior',
  );
  replaceRequired(
    state,
    'className="scrollbar-none flex-1 space-y-6 overflow-y-auto p-6"',
    'className="scrollbar-none flex-1 space-y-6 overflow-y-auto p-6 pb-32"',
    'Notificações: reserva inferior',
  );
  finish(state, 'Entregas: Notificações mantém rodapé e safe areas');
}

{
  const state = load('.work/entregas/src/routes/perfil/legal.tsx');
  ensureImport(state);
  ensureFooter(state);
  replaceRequired(
    state,
    'className="z-50 flex shrink-0 items-center justify-between border-b border-zinc-900 bg-black/80 px-4 pb-3 pt-8 backdrop-blur-lg"',
    'className="z-50 flex shrink-0 items-center justify-between border-b border-zinc-900 bg-black/80 px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-lg"',
    'Legal: safe area superior',
  );
  replaceRequired(
    state,
    'className="scrollbar-none flex-1 space-y-6 overflow-y-auto p-6"',
    'className="scrollbar-none flex-1 space-y-6 overflow-y-auto p-6 pb-32"',
    'Legal: reserva inferior',
  );
  finish(state, 'Entregas: Legal mantém rodapé e safe areas');
}

{
  const state = load('.work/entregas/src/routes/perfil/ajuda.tsx');
  ensureImport(state);
  ensureFooter(state);
  replaceRequired(
    state,
    'className="z-50 flex shrink-0 items-center justify-between border-b border-zinc-900 bg-black/80 p-4 backdrop-blur-lg"',
    'className="z-50 flex shrink-0 items-center justify-between border-b border-zinc-900 bg-black/80 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-lg"',
    'Ajuda: safe area superior',
  );
  replaceRequired(
    state,
    'className="scrollbar-none flex-1 space-y-8 overflow-y-auto p-6"',
    'className="scrollbar-none flex-1 space-y-8 overflow-y-auto p-6 pb-32"',
    'Ajuda: reserva inferior',
  );
  finish(state, 'Entregas: Ajuda mantém rodapé e safe areas');
}
