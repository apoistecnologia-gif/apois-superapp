import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function patch(relativePath, transform, verify, label) {
  const path = resolve('.work/entregas', relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato visual não confirmado em ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

function addProfileBottomNav(source) {
  let next = source;
  if (!next.includes('import { AppBottomNav } from "@/components/AppBottomNav";')) {
    const importAnchor = 'import { supabase } from "@/integrations/supabase/client";';
    if (!next.includes(importAnchor)) throw new Error('import do Supabase não encontrado para inserir AppBottomNav');
    next = next.replace(importAnchor, `${importAnchor}\nimport { AppBottomNav } from "@/components/AppBottomNav";`);
  }
  if (!next.includes('<AppBottomNav activeTab="perfil" />')) {
    const closing = '\n    </div>\n  );\n}';
    const index = next.lastIndexOf(closing);
    if (index < 0) throw new Error('fechamento da página não encontrado para inserir AppBottomNav');
    next = `${next.slice(0, index)}\n      <AppBottomNav activeTab="perfil" />${next.slice(index)}`;
  }
  return next;
}

patch('src/routes/perfil/pagamentos.tsx', (source) => {
  let next = addProfileBottomNav(source);
  next = next.replace('import { ArrowLeft, CreditCard, Landmark } from "lucide-react";', 'import { ArrowLeft, Landmark } from "lucide-react";');

  const methodsStart = next.indexOf('  const paymentMethods = [');
  const returnStart = next.indexOf('\n\n  return (', methodsStart);
  if (methodsStart >= 0 && returnStart > methodsStart) {
    next = next.slice(0, methodsStart) + next.slice(returnStart + 2);
  }

  next = next.replace(
    '<main className="scrollbar-none flex-1 space-y-8 overflow-y-auto p-6 pb-10">',
    '<main className="scrollbar-none flex-1 space-y-6 overflow-y-auto px-4 pb-32 pt-5 sm:px-6">',
  );
  next = next.replace(
    'px-4 pb-4 pt-[max(env(safe-area-inset-top),1.35rem)]',
    'px-4 pb-3 pt-[max(env(safe-area-inset-top),0.85rem)]',
  );

  const oldMethods = `        <section className="space-y-4">\n          <h2 className="ml-1 text-xs font-bold uppercase tracking-widest text-primary">\n            Métodos de pagamento\n          </h2>\n          <div className="space-y-3">\n            {paymentMethods.map((method) => (\n              <div\n                key={method.id}\n                className={\`flex items-center justify-between rounded-2xl border p-4 \${\n                  method.enabled\n                    ? "border-primary/20 bg-primary/5"\n                    : "border-zinc-900/50 bg-zinc-900/30 opacity-60"\n                }\`}\n              >\n                <div className="flex items-center gap-4">\n                  <div\n                    className={\`rounded-xl border border-zinc-800 bg-zinc-900 p-3 \${method.color}\`}\n                  >\n                    <method.icon className="h-6 w-6" />\n                  </div>\n                  <div>\n                    <div className="flex items-center gap-2">\n                      <p className="text-sm font-bold text-zinc-200">{method.label}</p>\n                      {method.enabled ? (\n                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-black uppercase text-primary">\n                          Disponível\n                        </span>\n                      ) : null}\n                    </div>\n                    <p className="text-xs text-zinc-500">{method.description}</p>\n                  </div>\n                </div>\n              </div>\n            ))}\n          </div>\n        </section>\n\n        <section className="space-y-4">\n          <h2 className="ml-1 text-center text-xs font-bold uppercase tracking-widest text-primary">\n            Cartões salvos\n          </h2>\n          <div className="flex flex-col items-center justify-center space-y-4 rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/20 p-8 text-center">\n            <div className="rounded-full bg-zinc-900/50 p-4 text-zinc-700">\n              <CreditCard className="h-10 w-10" />\n            </div>\n            <div className="space-y-1">\n              <p className="text-sm font-bold text-zinc-400">Cartões ainda não disponíveis</p>\n              <p className="px-4 text-xs text-zinc-600">\n                O cadastro de cartões só será liberado quando esse método estiver integrado e\n                habilitado no checkout.\n              </p>\n            </div>\n          </div>\n        </section>`;
  const pixOnly = `        <section className="space-y-3">\n          <h2 className="ml-1 text-xs font-bold uppercase tracking-widest text-primary">\n            Forma disponível\n          </h2>\n          <div className="flex items-center gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">\n            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-primary">\n              <Landmark className="h-6 w-6" />\n            </div>\n            <div className="min-w-0">\n              <div className="flex flex-wrap items-center gap-2">\n                <p className="text-sm font-bold text-zinc-100">Pix</p>\n                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-black uppercase text-primary">\n                  Disponível\n                </span>\n              </div>\n              <p className="mt-1 text-xs leading-relaxed text-zinc-500">\n                O Pix é apresentado automaticamente ao finalizar o pedido.\n              </p>\n            </div>\n          </div>\n        </section>`;
  if (next.includes(oldMethods)) next = next.replace(oldMethods, pixOnly);

  next = next.replace(
    'No momento, o checkout da APOIS ENTREGA aceita apenas PIX. A cobrança é criada pelo\n              provedor de pagamentos integrado e o pedido só avança após a confirmação do pagamento.',
    'No momento, o checkout da APOIS ENTREGA utiliza Pix. O pedido avança após a confirmação do pagamento.',
  );
  return next;
}, (source) =>
  source.includes('<AppBottomNav activeTab="perfil" />') &&
  source.includes('pb-32') &&
  source.includes('Forma disponível') &&
  source.includes('O Pix é apresentado automaticamente') &&
  !source.includes('Cartões salvos') &&
  !source.includes('Cartão de Crédito/Débito') &&
  !source.includes('CreditCard'),
'Entregas: Pagamentos exibe somente Pix real, sem cartão desabilitado, e mantém rodapé');

for (const page of [
  ['src/routes/perfil/notificacoes.tsx', 'Notificações'],
  ['src/routes/perfil/legal.tsx', 'Legal'],
  ['src/routes/perfil/ajuda.tsx', 'Ajuda'],
]) {
  patch(page[0], (source) => {
    let next = addProfileBottomNav(source);
    next = next.replaceAll('className="scrollbar-none flex-1 space-y-6 overflow-y-auto p-6"', 'className="scrollbar-none flex-1 space-y-6 overflow-y-auto px-4 pb-32 pt-5 sm:px-6"');
    next = next.replaceAll('className="scrollbar-none flex-1 space-y-8 overflow-y-auto p-6"', 'className="scrollbar-none flex-1 space-y-8 overflow-y-auto px-4 pb-32 pt-5 sm:px-6"');
    next = next.replaceAll('bg-black/80 p-4 backdrop-blur-lg', 'bg-black/80 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.85rem)] backdrop-blur-lg');
    next = next.replaceAll('bg-black/80 px-4 pb-3 pt-8 backdrop-blur-lg', 'bg-black/80 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.85rem)] backdrop-blur-lg');
    if (page[1] === 'Ajuda') {
      next = next.replace(
        'className="w-full rounded-t-3xl border border-zinc-800 bg-zinc-950 p-5 sm:max-w-lg sm:rounded-3xl"',
        'className="max-h-[calc(100dvh-max(env(safe-area-inset-top),1rem))] w-full overflow-y-auto rounded-t-3xl border border-zinc-800 bg-zinc-950 px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-5 sm:max-w-lg sm:rounded-3xl"',
      );
    }
    return next;
  }, (source) =>
    source.includes('<AppBottomNav activeTab="perfil" />') &&
    source.includes('pb-32') &&
    source.includes('pt-[max(env(safe-area-inset-top),0.85rem)]') &&
    (page[1] !== 'Ajuda' || source.includes('max-h-[calc(100dvh-max(env(safe-area-inset-top),1rem))]')),
  `Entregas: ${page[1]} mantém navegação inferior e safe-area em celular`);
}

console.log('[OK] Entregas: páginas secundárias do Perfil mantêm rodapé, não expõem opções de pagamento inexistentes e respeitam telas pequenas/teclado.');
