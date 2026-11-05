import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Validate the ACTUAL generated module file after all APK hardeners were applied.
const root = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const src = readFileSync(resolve(root, "src/routes/_authenticated.buscar-destino.tsx"), "utf8");
const service = readFileSync(resolve(root, "src/services/places/places-service.ts"), "utf8");
const hook = readFileSync(resolve(root, "src/hooks/use-destination-search.tsx"), "utf8");
for (const marker of [
  "APOIS_CLIENTE_DESTINATION_RESULTS_V4",
  "if (!input.isConnected) return;",
  'input.addEventListener("keyup", schedule)',
  'input.removeEventListener("keyup", schedule)',
  "start(); // Poll while this search screen is mounted",
  'data-apois-destination-live-results-v4',
  "query.trim().length < 3 ? (",
  'onClick={() => handleSelectSuggestion(suggestion)}',
  'data-apois-places-error-v2',
  'data-apois-places-empty-v2',
  'data-apois-destination-local-match-v3',
  'data-apois-favorite-save-mode="true"',
  "handleFinalSelection(details)",
]) assert.ok(src.includes(marker), "Android destination V4 contract failed: " + marker);
assert.ok(!src.includes('<AnimatePresence mode="wait">'), "Results must switch immediately, never wait for exiting history");
assert.ok(!src.includes('input.addEventListener("blur", stop);'), "Transient Android IME blur must not stop polling");
assert.ok(service.includes('invoke("google-maps-address"'), "Canonical Places backend must remain intact");
assert.ok(service.includes('action: "autocomplete"'), "Autocomplete backend contract preserved");
assert.ok(service.includes('action: "place_details"'), "Selection/details backend contract preserved");
assert.ok(hook.includes("requestSequence.current"), "Out-of-order predictions still ignored");
assert.ok(hook.includes('setSuggestions(results);'), "Provider suggestions must be stored in state");

// Evaluate the reconciliation BODY from the generated React component (not a
// copied implementation). Android can report activeElement=BODY even when the
// input visually holds text. This used to exit without applying setQuery.
const pattern = /    const reconcile = \(\) => \{([\s\S]*?)\n    \};/g;
const reconciles = [...src.matchAll(pattern)];
assert.equal(reconciles.length, 1, "Expected one real mounted-input reconcile handler");
const nativeReconcile = new Function(
  "input", "latestQueryRef", "latestSetQueryRef",
  "return function reconcile() {" + reconciles[0][1] + "\n}",
);
const input = { value: "River shopping", isConnected: true };
const latestQueryRef = { current: "" };
const updates = [];
const latestSetQueryRef = { current: (value) => updates.push(value) };
const reconcile = nativeReconcile(input, latestQueryRef, latestSetQueryRef);
reconcile();
assert.deepEqual(updates, ["River shopping"], "Android text must reach React without activeElement gate");
reconcile();
assert.equal(updates.length, 1, "Do not issue duplicate searches for unchanged text");
input.isConnected = false;
input.value = "Outro endereço";
reconcile();
assert.equal(updates.length, 1, "Detached input must never change screen state");
console.log("[PASS] Cliente Android V4: native input reaches React even without focus metadata; result panel switches immediately; Places, retry, favorites, ride selection preserved.");
