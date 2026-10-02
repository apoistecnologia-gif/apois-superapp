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
  (source) => {
    let next = source;

    if (!next.includes('APOIS_PLACES_PREWARM_V1')) {
      next = next.replace(
        '  // Clean up on unmount\n  useEffect(() => {',
        '  // APOIS_PLACES_PREWARM_V1: carrega a biblioteca Places antes da primeira digitação.\n  useEffect(() => {\n    void placesService.initialize().catch(() => undefined);\n  }, []);\n\n  // Clean up on unmount\n  useEffect(() => {',
      );
    }

    next = next
      .replace('}, 300);', '}, 80);')
      .replace('}, 120);', '}, 80);');

    return next;
  },
  (source) =>
    source.includes('APOIS_PLACES_PREWARM_V1') &&
    source.includes('placesService.initialize()') &&
    source.includes('}, 80);'),
  'Corridas: autocomplete pré-aquece Places e responde com debounce curto',
);

patch(
  'src/hooks/use-route.tsx',
  (source) => source
    .replace('    }, 500);', '    }, 100);')
    .replace('    }, 300);', '    }, 100);'),
  (source) => source.includes('    }, 100);') && source.includes('calculateRoute();'),
  'Corridas: cálculo de rota inicia sem espera artificial de meio segundo',
);

patch(
  'src/hooks/use-pricing.tsx',
  (source) => {
    let next = source
      .replace('    }, 500);', '    }, 60);')
      .replace('    }, 300);', '    }, 60);');

    if (!next.includes('APOIS_PRICING_SEQ_V1')) {
      next = next.replace(
        '  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);',
        '  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);\n  const pricingSeqRef = useRef(0); // APOIS_PRICING_SEQ_V1',
      );
      next = next.replace(
        '    setStatus("loading");\n    setError(null);',
        '    const seq = ++pricingSeqRef.current;\n    setStatus("loading");\n    setError(null);',
      );
      next = next.replace(
        '      const response = await pricingService.estimateFares(request);\n      setEstimates(response.estimates);\n      setStatus("success");',
        '      const response = await pricingService.estimateFares(request);\n      if (seq !== pricingSeqRef.current) return;\n      setEstimates(response.estimates);\n      setStatus("success");',
      );
      next = next.replace(
        '    } catch (err) {\n      console.error("[PricingProvider] Error calculating pricing:", err);',
        '    } catch (err) {\n      if (seq !== pricingSeqRef.current) return;\n      console.error("[PricingProvider] Error calculating pricing:", err);',
      );
    }

    return next;
  },
  (source) =>
    source.includes('APOIS_PRICING_SEQ_V1') &&
    source.includes('if (seq !== pricingSeqRef.current) return;') &&
    source.includes('    }, 60);'),
  'Corridas: preço calcula logo após a rota e ignora respostas antigas',
);

patch(
  'src/routes/_authenticated.inicio.tsx',
  (source) => {
    let next = source;

    if (!next.includes('apois-ride-confirm-cta')) {
      next = next.replace(
        '"w-full flex items-center justify-center gap-2 py-5 rounded-2xl font-black transition-all active:scale-95 shadow-lg",',
        '"apois-ride-confirm-cta sticky bottom-0 z-30 w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black transition-all active:scale-[0.98] shadow-[0_14px_32px_rgba(0,0,0,.5)]",',
      );
    }

    next = next.replace(
      '<div className="animate-in fade-in slide-in-from-bottom duration-300 space-y-4">',
      '<div className="animate-in fade-in slide-in-from-bottom duration-300 space-y-4 pb-2">',
    );

    return next;
  },
  (source) =>
    source.includes('apois-ride-confirm-cta') &&
    source.includes('sticky bottom-0 z-30') &&
    source.includes('onClick={handleReview}') &&
    source.includes('disabled={!checkout.readiness || !!routeError}'),
  'Corridas: CTA de confirmar/prosseguir permanece visível após o preço',
);

console.log('[OK] APOIS_CORRIDAS_RESPONSIVE_FLOW_V1: busca, rota, preço e CTA ajustados sem alterar regras de negócio.');
