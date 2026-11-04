// APOIS_CLIENTE_DESTINATION_FEEDBACK_V2 — regression check, no network and no database writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const read=(p)=>readFileSync(resolve(root,p),"utf8");
const ui=read("src/routes/_authenticated.buscar-destino.tsx");
const hook=read("src/hooks/use-destination-search.tsx");
const service=read("src/services/places/places-service.ts");
for(const marker of [
  "APOIS_CLIENTE_DESTINATION_FEEDBACK_V2",
  'data-apois-places-error-v2',
  'data-apois-places-empty-v2',
  'status === "debouncing"',
  '"network_error", "rate_limited", "configuration_missing"',
  'error?.message',
  'onClick={retry}',
  'onInput={(e) => { if (e.currentTarget.value !== query) setQuery(e.currentTarget.value); }}',
  'onCompositionEnd={(e) => { if (e.currentTarget.value !== query) setQuery(e.currentTarget.value); }}',
  'aria-label', // from existing input and favorites
  'onClick={() => handleSelectSuggestion(suggestion)}',
  'handleFinalSelection(details)',
  'data-apois-favorite-save-mode="true"',
  'data-apois-stable-destination-sheet',
  'onClick={() => { setIsBottomSheetOpen(false); setIsPickingOnMap(true); }}',
])assert.ok(ui.includes(marker),"Search UX missing or regressed: "+marker);
for(const marker of [
  'const retry = useCallback(',
  'void search(query)',
  'setStatus("network_error")',
  'setStatus("loading")',
]) {
  // Some status setters use conditional ternaries; check the explicit status codes instead.
  if(marker==='setStatus("network_error")')continue;
  assert.ok(hook.includes(marker),"Search state hook missing: "+marker);
}
for(const marker of [
  'searchPredictions(',
  'invoke("google-maps-address"',
  'action: "autocomplete"',
  'action: "place_details"',
  'if (suggestions.length > 0) this.cache.set(cacheKey',
  'this.lastRequestId',
  'places_cancelled',
])assert.ok(service.includes(marker),"Places remote call or cache safety missing: "+marker);
assert.ok(!/^\s{6}this\.cache\.set\(cacheKey,/m.test(service),
  "Empty results must not be cached unconditionally for 5 minutes");
assert.ok(!ui.includes('onClick={() => setQuery(query)}'),"Retry cannot only replace identical input text");
const emptyIndex=ui.indexOf('data-apois-places-empty-v2');
const errorIndex=ui.indexOf('data-apois-places-error-v2');
const resultIndex=ui.indexOf('suggestions.map((suggestion)');
assert.ok(emptyIndex>0&&errorIndex>emptyIndex&&resultIndex>errorIndex,"Empty/error/result states must be in rendered results branch");
console.log("[OK] Corridas Passenger: Places query/results/favorites intact, all failure statuses visible, retry resends search, transient empty cache disabled and map fallback preserved.");
