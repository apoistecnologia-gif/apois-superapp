import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
const fail = (message) => { console.error('[FAIL] Corridas passenger latency/CTA: ' + message); failed = true; };
const ok = (message) => console.log('[OK] Corridas passenger latency/CTA: ' + message);
const read = (path) => readFileSync(resolve(path), 'utf8');

const hardener = read('scripts/harden-corridas-fast-search-pricing-cta.mjs');
for (const marker of [
  "src/hooks/use-destination-search.tsx",
  ".replace('}, 120);', '}, 100);')",
  "src/hooks/use-route.tsx",
  "'    }, 120);'",
  "src/hooks/use-pricing.tsx",
  "'    }, 100);'",
  "src/routes/_authenticated.inicio.tsx",
  "bottom-[calc(78px+env(safe-area-inset-bottom))]",
  "Confirmar {selectedCategory?.name || \"Solicitação\"}",
  "onClick={handleReview}",
]) {
  if (!hardener.includes(marker)) fail('hardener sem marcador: ' + marker);
}
if (!failed) ok('hardener preserva busca sem stale response, rota/preço rápidos e CTA canônico visível');

const build = read('scripts/build-isolated-module.mjs');
const localIndex = build.indexOf("harden-corridas-local-place-search.mjs");
const fastIndex = build.indexOf("harden-corridas-fast-search-pricing-cta.mjs");
const authIndex = build.indexOf("harden-corridas-oauth-callback-handoff.mjs");
if (localIndex < 0 || fastIndex < 0 || authIndex < 0 || !(localIndex < fastIndex && fastIndex < authIndex)) {
  fail('cadeia Corridas não executa o hardener de latência/CTA após a restrição local');
} else {
  ok('build Corridas executa o hardener focado na ordem correta');
}

const localSearch = read('scripts/harden-corridas-local-place-search.mjs');
for (const marker of ['locationRestriction', 'localityHint?: string', 'localSuggestions']) {
  if (!localSearch.includes(marker)) fail('restrição local ausente: ' + marker);
}
if (!failed) ok('ganho de velocidade não remove a restrição por região/município');

process.exit(failed ? 1 : 0);
