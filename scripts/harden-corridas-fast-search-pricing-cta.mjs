import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error('[FAIL] ' + label + ': contrato final não confirmado');
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log('[OK] ' + label + (after === before ? ' (já aplicado)' : ''));
}

patch(
  'src/hooks/use-destination-search.tsx',
  (source) => source.replace('}, 300);', '}, 100);'),
  (source) => source.includes('}, 100);') && source.includes('searchSeq'),
  'Corridas: sugestões de endereço reduzem debounce sem aceitar resposta antiga',
);

patch(
  'src/hooks/use-route.tsx',
  (source) => source.replace('    }, 500);', '    }, 120);'),
  (source) => source.includes('    }, 120);') && source.includes('calculateRoute();'),
  'Corridas: cálculo de rota inicia mais rápido após destino',
);

patch(
  'src/hooks/use-pricing.tsx',
  (source) => source.replace('    }, 500);', '    }, 100);'),
  (source) => source.includes('    }, 100);') && source.includes('calculatePricing();'),
  'Corridas: cálculo de preços reduz espera artificial',
);

patch(
  'src/routes/_authenticated.inicio.tsx',
  (source) => {
    let next = source;
    next = next.replace(
      'className="animate-in fade-in slide-in-from-bottom duration-300 space-y-4"',
      'className="animate-in fade-in slide-in-from-bottom duration-300 space-y-4 pb-24"',
    );
    next = next.replace(
      '"w-full flex items-center justify-center gap-2 py-5 rounded-2xl font-black transition-all active:scale-95 shadow-lg",',
      '"fixed bottom-[calc(78px+env(safe-area-inset-bottom))] left-1/2 z-[90] w-[calc(100%-32px)] max-w-[398px] -translate-x-1/2 flex items-center justify-center gap-2 py-4 rounded-2xl font-black transition-all active:scale-95 shadow-2xl",',
    );
    return next;
  },
  (source) =>
    source.includes('pb-24') &&
    source.includes('bottom-[calc(78px+env(safe-area-inset-bottom))]') &&
    source.includes('Confirmar {selectedCategory?.name || "Solicitação"}') &&
    source.includes('onClick={handleReview}'),
  'Corridas: CTA de prosseguir permanece visível acima da navegação',
);

console.log('[OK] Corridas: busca, rota, preço e CTA ajustados sem alterar regra de negócio.');
