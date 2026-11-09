// APOIS Report 13 / INV-066: only generated code snippets + in-memory mocks.
// No real localStorage, Supabase, Google Maps, navigation or user accounts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const read = (p) => readFileSync(resolve(root, p), "utf8");
const route = read("src/routes/_authenticated.buscar-destino.tsx");
const provider = read("src/hooks/use-destination-history.tsx");
const recent = read("src/services/destinations/recent-destinations-service.ts");
const store = read("src/services/destinations/destination-storage.ts");
const favorites = read("src/services/destinations/favorites-service.ts");

function between(source, from, to) {
  const a = source.indexOf(from);
  const b = source.indexOf(to, a + from.length);
  assert.ok(a >= 0 && b > a, "missing callback boundaries: " + from);
  return source.slice(a, b);
}
const helperSrc = between(route,
  "  // APOIS_REPORT13_HISTORY_SELECTION_V1", "  const beginSaving=");
const suggestionSrc = between(route,
  "  const handleSelectSuggestion =", "  const handleQuickAction =");
const mapSrc = between(route,
  "  const handleConfirmMapSelection =", "  const getFavoriteIcon");
const js = (s) => s
  .replaceAll(": DestinationAddress", "")
  .replaceAll(":DestinationAddress", "")
  .replace(/:\s*boolean\s*=>/g, " =>")
  .replace('target:"home"|"briefcase"|"heart"', "target")
  .replace("suggestion: PlaceSuggestion", "suggestion")
  .replace("item: DestinationAddress", "item")
  .replace("catch (err: any)", "catch (err)");
const callbacksSrc = js(helperSrc + "\n" + suggestionSrc + "\n" + mapSrc);

function sample(override = {}) {
  return {
    placeId: "p:example", latitude: -9.3891, longitude: -40.5031,
    label: "Rua Exemplo", formattedAddress: "Rua Exemplo, Centro",
    name: "Rua Exemplo", source: "google_places", components: {},
    selectedAt: "2026-11-09T12:00:00Z", types: [],
    ...override,
  };
}
function harness({
  history = () => true, favorite = () => true,
  details = sample(), placesError = null, saveTarget = null,
  stop = false, geocode = null,
} = {}) {
  const state = {
    selected: [], historyInputs: [], favorites: [], toast: { warning: [], success: [], error: [] },
    selecting: false, closedSheet: false, pickingMap: true, resolving: false,
    cleared: false, blurred: false, saveTarget,
  };
  const point = { lat: -9.3891, lng: -40.5031 };
  const selectionCenterRef = { current: point };
  const mapRequestSequenceRef = { current: 0 };
  const mapConfirmBusyRef = { current: false };
  const toast = {
    warning: (s) => state.toast.warning.push(s),
    success: (s) => state.toast.success.push(s),
    error: (s) => state.toast.error.push(s),
  };
  const placesService = { selectPrediction: async () => {
    if (placesError) throw placesError;
    return details;
  } };
  const geocodingService = { resolvePickupAddress: geocode ?? (async () => ({
    label: "Rua Exemplo", address: "Rua Exemplo, Centro",
  })) };
  const globals = {
    toast,
    addToHistory: (d) => { state.historyInputs.push(d); return history(d); },
    addFavorite: (d, name, icon) => { state.favorites.push({ d, name, icon }); return favorite(d); },
    handleFinalSelection: (d) => { state.selected.push({ destination: d, stop }); },
    setSaveTarget: (v) => { state.saveTarget = v; },
    clearQuery: () => { state.cleared = true; },
    inputRef: { current: { blur: () => { state.blurred = true; } } },
    setIsSelecting: (v) => { state.selecting = v; },
    isSelecting: false,
    saveTarget,
    placesService,
    geocodingService,
    selectionCenterRef,
    mapRequestSequenceRef,
    mapConfirmBusyRef,
    isResolvingMapSelection: false,
    setIsResolvingMapSelection: (v) => { state.resolving = v; },
    isStopSelection: stop,
    setIsPickingOnMap: (v) => { state.pickingMap = v; },
    setIsBottomSheetOpen: (v) => { state.closedSheet = !v; },
  };
  const factory = new Function(
    ...Object.keys(globals),
    callbacksSrc + "\nreturn {isSelectableAddress,completeAddressSelection,saveAddress,handleSelectSuggestion,handleSelectHistoryItem,handleConfirmMapSelection};",
  );
  return { state, callbacks: factory(...Object.values(globals)), selectionCenterRef };
}

test("INV-066: generated handlers and original storage rules are preserved", () => {
  for (const marker of [
    "APOIS_REPORT13_HISTORY_SELECTION_V1", "APOIS_REPORT12_MAP_SELECTION_V1",
    "placesService.selectPrediction(suggestion)",
    "if(saveTarget){saveAddress(details,saveTarget);return;}",
    "if(saveTarget){saveAddress(item,saveTarget);return;}",
    "data-apois-favorite-save-mode",
    "data-apois-places-error-v2",
  ]) assert.ok(route.includes(marker), marker);
  assert.ok(provider.includes("addToHistory: (destination: DestinationAddress) => boolean;"));
  assert.ok(provider.includes(") => boolean;"));
  assert.ok(recent.includes("MAX_ITEMS = 20"));
  assert.ok(recent.includes("recent.filter("));
  assert.ok(store.includes("SUPERAPP_CORRIDAS_AUTH_STORAGE_KEY"));
  assert.ok(favorites.includes('destination.icon === "home" || destination.icon === "briefcase"'));
  assert.ok(favorites.includes("favorites.some((item) => item.placeId === destination.placeId)"));
});

test("INV-066: valid suggestion + quota error selects destination, warns only about history", async () => {
  const h = harness({ history: () => { throw new Error("QuotaExceededError technical detail"); } });
  await h.callbacks.handleSelectSuggestion({ placeId: "p:example" });
  assert.equal(h.state.selected.length, 1);
  assert.equal(h.state.historyInputs.length, 1);
  assert.equal(h.state.toast.warning.length, 1);
  assert.match(h.state.toast.warning[0], /histórico/);
  assert.ok(!h.state.toast.warning[0].includes("QuotaExceededError"));
  assert.equal(h.state.toast.error.length, 0);
  assert.equal(h.state.selecting, false);
});

test("INV-066: successful history keeps normal selection without warning", async () => {
  const h = harness();
  await h.callbacks.handleSelectSuggestion({ placeId: "p:example" });
  assert.equal(h.state.selected.length, 1);
  assert.equal(h.state.historyInputs.length, 1);
  assert.equal(h.state.toast.warning.length, 0);
  assert.equal(h.state.toast.error.length, 0);
});

test("INV-066: provider details error is not swallowed and cannot select destination", async () => {
  const h = harness({ placesError: { message: "Não foi possível abrir este local." } });
  await h.callbacks.handleSelectSuggestion({ placeId: "p:example" });
  assert.equal(h.state.selected.length, 0);
  assert.equal(h.state.historyInputs.length, 0);
  assert.equal(h.state.toast.warning.length, 0);
  assert.equal(h.state.toast.error.length, 1);
});

test("INV-066: invalid suggestion and corrupted recent data do not select or save", async () => {
  const h = harness({ details: sample({ latitude: 95 }) });
  await h.callbacks.handleSelectSuggestion({ placeId: "p:example" });
  assert.equal(h.state.selected.length, 0);
  assert.equal(h.state.historyInputs.length, 0);
  assert.equal(h.state.toast.error.length, 1);
  const h2 = harness();
  h2.callbacks.handleSelectHistoryItem(sample({ longitude: NaN }));
  assert.equal(h2.state.selected.length, 0);
  assert.equal(h2.state.historyInputs.length, 0);
  assert.equal(h2.state.toast.error.length, 1);
});

test("INV-066: stop selection survives denied local history", async () => {
  const h = harness({ history: () => { throw new Error("SecurityError"); }, stop: true });
  await h.callbacks.handleSelectSuggestion({ placeId: "p:example" });
  assert.equal(h.state.selected.length, 1);
  assert.equal(h.state.selected[0].stop, true);
  assert.equal(h.state.toast.warning.length, 1);
});

test("INV-066: explicit favorite never claims save when storage failed or no auth", async () => {
  const failed = harness({ saveTarget: "home", favorite: () => { throw new Error("QuotaExceededError"); } });
  await failed.callbacks.handleSelectSuggestion({ placeId: "p:example" });
  assert.equal(failed.state.selected.length, 0);
  assert.equal(failed.state.toast.success.length, 0);
  assert.equal(failed.state.toast.error.length, 1);
  assert.equal(failed.state.saveTarget, "home");
  assert.equal(failed.state.cleared, false);
  const noUser = harness({ saveTarget: "heart", favorite: () => false });
  await noUser.callbacks.handleSelectSuggestion({ placeId: "p:example" });
  assert.equal(noUser.state.toast.success.length, 0);
  assert.equal(noUser.state.toast.error.length, 1);
});

test("INV-066: verified favorite save alone gets success, never changes destination", async () => {
  const h = harness({ saveTarget: "briefcase" });
  await h.callbacks.handleSelectSuggestion({ placeId: "p:example" });
  assert.equal(h.state.favorites.length, 1);
  assert.equal(h.state.favorites[0].icon, "briefcase");
  assert.equal(h.state.selected.length, 0);
  assert.equal(h.state.historyInputs.length, 0);
  assert.equal(h.state.toast.success.length, 1);
  assert.equal(h.state.saveTarget, null);
});

test("INV-066: map select handles failed history while retaining true map confirmation", async () => {
  const h = harness({ history: () => { throw new Error("storage denied"); } });
  await h.callbacks.handleConfirmMapSelection();
  assert.equal(h.state.selected.length, 1);
  assert.equal(h.state.toast.success.length, 1);
  assert.equal(h.state.toast.warning.length, 1);
  assert.equal(h.state.selected[0].destination.source, "map_selection");
});

test("INV-066: map favorite storage failure leaves chooser open and no false success", async () => {
  const h = harness({ saveTarget: "home", favorite: () => false });
  await h.callbacks.handleConfirmMapSelection();
  assert.equal(h.state.selected.length, 0);
  assert.equal(h.state.toast.success.length, 0);
  assert.equal(h.state.toast.error.length, 1);
  assert.equal(h.state.pickingMap, true);
});

function extractedProviderCallback(name, nextName) {
  const source = between(provider,
    "  const " + name + " = useCallback(", "\n  const " + nextName + " =");
  const open = source.indexOf("=> {");
  const close = source.lastIndexOf("\n    },");
  assert.ok(open >= 0 && close > open);
  return source.slice(open + 4, close)
    .replace("const newItem: DestinationHistoryItem", "const newItem")
    .replace("const newItem: any", "const newItem")
    .replace(" as DestinationHistoryItem", "");
}
function providerCallback(name, nextName, { user = { id: "synthetic" }, write, refresh }) {
  const body = extractedProviderCallback(name, nextName);
  const crypto = { randomUUID: () => "synthetic-uuid" };
  const recentDestinationsService = { addRecent: write };
  const favoritesService = { addFavorite: write };
  const fn = new Function(
    "destination", "nickname", "icon", "user", "recentDestinationsService",
    "favoritesService", "refresh", "crypto", "Date", body,
  );
  return (destination) => fn(destination, "Casa", "home", user,
    recentDestinationsService, favoritesService, refresh, crypto, Date);
}

test("INV-066: provider acknowledges write, not a later refresh read", () => {
  let writes = 0;
  const recentCallback = providerCallback("addToHistory", "toggleFavorite", {
    write: () => { writes += 1; }, refresh: () => { throw Error("read denied"); },
  });
  assert.equal(recentCallback(sample()), true);
  assert.equal(writes, 1);

  const favoritesCallback = providerCallback("addFavorite", "removeFavorite", {
    write: () => { writes += 1; }, refresh: () => { throw Error("read denied"); },
  });
  assert.equal(favoritesCallback(sample()), true);
  assert.equal(writes, 2);
});

test("INV-066: provider cannot acknowledge missing session or rejected writes", () => {
  let writes = 0;
  const anon = providerCallback("addFavorite", "removeFavorite", {
    user: null, write: () => { writes += 1; }, refresh: () => {},
  });
  assert.equal(anon(sample()), false);
  assert.equal(writes, 0);

  const quota = providerCallback("addToHistory", "toggleFavorite", {
    write: () => { throw Error("quota"); }, refresh: () => {},
  });
  assert.throws(() => quota(sample()), /quota/);
});


test("INV-066: original recent storage tolerates corrupt JSON but surfaces denied reads", () => {
  const declaration = "  public static getRecent(): DestinationHistoryItem[] {";
  const start = store.indexOf(declaration);
  const end = store.indexOf("\n  }\n", start + declaration.length);
  assert.ok(start >= 0 && end > start, "pinned recent reader missing");
  const body = store.slice(start + declaration.length, end);
  const makeReader = (localStorage) =>
    new Function("localStorage", "return function() {" + body + "\n};")(localStorage);
  const broken = makeReader({ getItem: () => "{corrupted-json" });
  assert.equal(broken.call({ getRecentKey: () => "synthetic-recent" }).length, 0);
  const denied = makeReader({ getItem: () => { throw Error("synthetic-read-denied"); } });
  assert.throws(() => denied.call({ getRecentKey: () => "synthetic-recent" }), /synthetic-read-denied/);
});

test("INV-066: existing recent service still deduplicates and caps twenty items", () => {
  const declaration = "  public addRecent(destination: DestinationHistoryItem): void {";
  const start = recent.indexOf(declaration);
  const end = recent.indexOf("\n  }\n", start + declaration.length);
  assert.ok(start >= 0 && end > start, "pinned addRecent behavior missing");
  const body = recent.slice(start + declaration.length, end);
  const items = Array.from({ length: 20 }, (_, i) => sample({
    placeId: "p:" + i, id: "old:" + i,
  }));
  let saved = null;
  const addRecent = new Function("RecentDestinationsService", "DestinationStorage", "Date",
    "return function(destination) {" + body + "\n};")(
    { MAX_ITEMS: 20 }, { saveRecent: (value) => { saved = value; } }, Date,
  );
  addRecent.call({ getRecent: () => items }, sample({ placeId: "p:7", id: "new" }));
  assert.equal(saved.length, 20);
  assert.equal(saved[0].placeId, "p:7");
  assert.equal(saved.filter((item) => item.placeId === "p:7").length, 1);
  assert.equal(saved.some((item) => item.placeId === "p:19"), true);
  addRecent.call({ getRecent: () => items }, sample({ placeId: "p:20", id: "newest" }));
  assert.equal(saved.length, 20);
  assert.equal(saved[0].placeId, "p:20");
  assert.equal(saved.some((item) => item.placeId === "p:19"), false);
});
