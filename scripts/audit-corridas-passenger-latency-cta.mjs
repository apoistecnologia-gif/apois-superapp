import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error('[FAIL] Corridas passenger latency/CTA: ' + message); failed = true; };
const ok = (message) => console.log('[OK] Corridas passenger latency/CTA: ' + message);
const read = (path) => readFileSync(resolve(path), 'utf8');

const responsive = read('scripts/harden-corridas-responsive-flow.mjs');
for (const marker of [
  'APOIS_PLACES_PREWARM_V1',
  'placesService.initialize()',
  ".replace('}, 120);', '}, 80);')",
  "'    }, 100);'",
  'APOIS_PRICING_SEQ_V1',
  "'    }, 60);'",
  'apois-ride-confirm-cta',
  'sticky bottom-0 z-30',
  'onClick={handleReview}',
  'disabled={!checkout.readiness || !!routeError}',
]) {
  if (!responsive.includes(marker)) fail('responsive-flow sem marcador: ' + marker);
}
if (!failed) ok('hardener canônico cobre autocomplete, rota, pricing e CTA sem alterar regra de negócio');

const modules = read('.apois/modules.json');
const homeIndex = modules.indexOf('harden-corridas-home-compact.mjs');
const responsiveIndex = modules.indexOf('harden-corridas-responsive-flow.mjs');
const brandIndex = modules.indexOf('apply-apois-brand-v2.mjs corridas');
if (homeIndex < 0 || responsiveIndex < 0 || brandIndex < 0 || !(homeIndex < responsiveIndex && responsiveIndex < brandIndex)) {
  fail('cadeia Corridas não executa responsive-flow na ordem esperada');
} else {
  ok('build Corridas executa responsive-flow após Home compacta e antes do Brand V2');
}

const build = read('scripts/build-isolated-module.mjs');
if (build.includes("run(process.execPath, [resolve(root, 'scripts/harden-corridas-fast-search-pricing-cta.mjs')])")) {
  fail('hardener duplicado fast-search-pricing-cta voltou à cadeia e conflita com responsive-flow');
} else {
  ok('hardener duplicado conflitante está fora da cadeia de build');
}

const localSearch = read('scripts/harden-corridas-local-place-search.mjs');
for (const marker of ['locationRestriction', 'localityHint?: string', 'localSuggestions']) {
  if (!localSearch.includes(marker)) fail('restrição local ausente: ' + marker);
}
if (!failed) ok('performance preserva restrição por região/município');

process.exit(failed ? 1 : 0);
