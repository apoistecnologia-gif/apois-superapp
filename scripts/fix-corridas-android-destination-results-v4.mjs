// APOIS_CLIENTE_DESTINATION_RESULTS_V4 — Android 16/Gboard: no stale history while typing.
// Fix only the rendered destination search and its native input reconciliation.
// Preserve canonical Supabase Places/Google Maps, GPS, favorites, stops and ride flow.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const file = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas", "src/routes/_authenticated.buscar-destino.tsx");
let src = readFileSync(file, "utf8");
function swap(before, after, reason) {
  const count = src.split(before).length - 1;
  if (count !== 1) throw Error("[FAIL] Destination V4 " + reason + ": expected one anchor, found " + count);
  src = src.replace(before, after);
}
if (src.includes("APOIS_CLIENTE_DESTINATION_RESULTS_V4")) throw Error("[FAIL] Destination V4 applied twice");

// A native keyboard sometimes keeps the DOM input focused in the Android IME
// while WebView reports document.activeElement as BODY. V3's focus guard then
// silently discarded native input values. Observe the mounted input directly.
swap(
  "      if (document.activeElement !== input) return;",
  "      // APOIS_CLIENTE_DESTINATION_RESULTS_V4: WebView activeElement may be BODY with Gboard open.\n      if (!input.isConnected) return;",
  "remove unreliable Android focus gate",
);
swap(
  '    input.addEventListener("compositionend", schedule);',
  '    input.addEventListener("compositionend", schedule);\n    input.addEventListener("keyup", schedule);',
  "recover Gboard keyup",
);
swap(
  '      input.removeEventListener("compositionend", schedule);',
  '      input.removeEventListener("compositionend", schedule);\n      input.removeEventListener("keyup", schedule);',
  "clean Gboard listener",
);
swap(
  '    input.addEventListener("blur", stop);',
  '    // Do not stop reconciliation on Android IME transient blur: cleanup on unmount.',
  "keep mounted input reconciliation after IME transient blur",
);
swap(
  '      input.removeEventListener("blur", stop);',
  '      // Interval is cleaned up on component unmount, even if WebView blurred temporarily.',
  "clean focus listener",
);
swap(
  '    if (document.activeElement === input) start();',
  '    start(); // Poll while this search screen is mounted, even if native focus metadata is stale.',
  "start regardless of Android activeElement",
);

// AnimatePresence mode=wait can retain the stale history screen while the
// native keyboard triggers rapid query transitions. Suggestions need to render
// synchronously when query has >= 3 characters, without exit-animation gating.
swap(
  '            <AnimatePresence mode="wait">',
  '            <div data-apois-destination-live-results-v4 role="region" aria-label="Resultados da busca de destino">',
  "replace waiting results transition with immediate render",
);
swap(
  '            </AnimatePresence>\n          </div>',
  '            </div>\n          </div>',
  "close immediate results container",
);
for (const marker of [
  "APOIS_CLIENTE_DESTINATION_RESULTS_V4",
  "if (!input.isConnected) return",
  'input.addEventListener("keyup", schedule)',
  "start(); // Poll while this search screen is mounted",
  'data-apois-destination-live-results-v4',
  'query.trim().length < 3 ? (',
  'onClick={() => handleSelectSuggestion(suggestion)}',
  'data-apois-places-error-v2',
  'data-apois-places-empty-v2',
  'data-apois-destination-local-match-v3',
  'data-apois-favorite-save-mode="true"',
  "handleFinalSelection(details)",
]) if (!src.includes(marker)) throw Error("[FAIL] Destination V4 preservation marker missing: " + marker);
if (src.includes('<AnimatePresence mode="wait">')) throw Error("[FAIL] Destination V4 still gates search results on exit animation");
writeFileSync(file, src, "utf8");
console.log("[OK] Cliente V4: WebView IME reconciliation does not depend on activeElement/blur; history no longer gates live provider suggestions.");
