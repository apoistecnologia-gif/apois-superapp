// APOIS Report 12 / INV-064/065 — synthetic-only. No Maps/Places or ride request.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const work = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const read = (path) => readFileSync(resolve(work, path), "utf8");
const service = read("src/services/places/places-service.ts");
const route = read("src/routes/_authenticated.buscar-destino.tsx");
const map = read("src/components/map/PassengerMap.tsx");
const types = read("src/types/places.ts");
const stops = read("src/types/rides/stops.ts");

function getCoordinateParser() {
  const start = service.indexOf("      const result = data?.result;");
  const end = service.indexOf("\n      const components: AddressComponent", start);
  assert.ok(start >= 0 && end > start, "existing Places details normalization must be present");
  const real = service.slice(start, end);
  return new Function("data", real + "\nreturn {latitude,longitude};");
}
function parsePosition(lat, lng) {
  const fn = getCoordinateParser();
  return fn.call({
    normalizeError: (code) => Object.assign(new Error(code), { code }),
  }, { result: { geometry: { location: { lat, lng } } } });
}

test("INV-064: null, undefined, blank strings, invalid numeric and world bounds reject", () => {
  for (const [lat, lng] of [
    [null, null], [undefined, undefined], ["", ""], ["9", "-40"],
    [NaN, -40], [-9, Number.POSITIVE_INFINITY], [95, 200],
    [-91, 0], [0, 181], [90.1, 10], [10, -181],
  ]) assert.throws(() => parsePosition(lat, lng), (e) => e.code === "places_invalid_location");
});

test("INV-064: world boundaries and true numeric (0,0) remain legal", () => {
  for (const [lat, lng] of [
    [0, 0], [-90, -180], [90, 180], [-9.3891, -40.5031],
  ]) assert.deepEqual(parsePosition(lat, lng), { latitude: lat, longitude: lng });
  assert.match(service, /action: "place_details"/);
  assert.match(service, /if \(suggestions.length > 0\) this.cache.set/);
  assert.match(service, /places_cancelled/);
});

function extractHandler() {
  const start = route.indexOf("  const handleConfirmMapSelection = async () => {");
  const end = route.indexOf("\n\n  const getFavoriteIcon", start);
  assert.ok(start >= 0 && end > start, "integrated route confirmation handler not found");
  return route.slice(start, end).trim()
    .replace("const handleConfirmMapSelection = ", "")
    .replace("const details: DestinationAddress", "const details")
    .replace(/;\s*$/, "");
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness({
  point = { lat: -9.3891, lng: -40.5031 },
  stop = false, saveTarget = null, resolveAddress,
} = {}) {
  const selectionCenterRef = { current: point };
  const mapRequestSequenceRef = { current: 0 };
  const mapConfirmBusyRef = { current: false };
  const state = {
    resolving: false, picking: true, sheet: false,
    history: [], destinations: [], saved: [], messages: [], errors: [],
  };
  const geocodingService = {
    resolvePickupAddress: async (p) => resolveAddress
      ? resolveAddress(p)
      : { label: "Rua Exemplo", address: "Rua Exemplo, Centro", components: { cidade: "Cidade" } },
  };
  const toast = { success: (v) => state.messages.push(v), error: (v) => state.errors.push(v) };
  const context = {
    isSelecting: false, isResolvingMapSelection: false,
    mapConfirmBusyRef, selectionCenterRef, mapRequestSequenceRef,
    setIsResolvingMapSelection: (v) => { state.resolving = v; },
    geocodingService, toast, saveTarget,
    saveAddress: (details, target) => { state.saved.push({ details, target }); },
    setIsPickingOnMap: (v) => { state.picking = v; },
    setIsBottomSheetOpen: (v) => { state.sheet = v; },
    addToHistory: (details) => { state.history.push(details); },
    handleFinalSelection: (details) => { state.destinations.push(details); },
    isStopSelection: stop,
  };
  const expression = extractHandler();
  const handler = new Function(...Object.keys(context), "return (" + expression + ");")(...Object.values(context));
  return { handler, state, selectionCenterRef, mapConfirmBusyRef, mapRequestSequenceRef };
}

test("INV-065: selecting B records B via existing final selection and history", async () => {
  const h = harness({ point: { lat: -9.4, lng: -40.6 } });
  await h.handler();
  assert.equal(h.state.destinations.length, 1);
  assert.equal(h.state.destinations[0].latitude, -9.4);
  assert.equal(h.state.destinations[0].longitude, -40.6);
  assert.equal(h.state.destinations[0].source, "map_selection");
  assert.ok(h.state.destinations[0].placeId.startsWith("map:"));
  assert.equal(h.state.history.length, 1);
  assert.equal(h.state.messages.length, 1);
  assert.equal(h.state.errors.length, 0);
});

test("INV-065: stop selection uses same confirmed destination path", async () => {
  const h = harness({ stop: true });
  await h.handler();
  assert.equal(h.state.destinations.length, 1);
  assert.match(h.state.messages[0], /Parada/);
  assert.match(route, /details.source === "map_selection" \? "map_selection"/);
  assert.match(stops, /"map_selection"/);
});

test("INV-065: favorites use approved saveAddress without setting destination", async () => {
  const h = harness({ saveTarget: "home" });
  await h.handler();
  assert.equal(h.state.saved.length, 1);
  assert.equal(h.state.saved[0].target, "home");
  assert.equal(h.state.destinations.length, 0);
  assert.equal(h.state.history.length, 0);
  assert.equal(h.state.picking, false);
  assert.equal(h.state.sheet, true);
});

test("INV-065: missing center / reverse failure never claims success", async () => {
  const noCenter = harness({ point: null });
  await noCenter.handler();
  assert.equal(noCenter.state.destinations.length, 0);
  assert.equal(noCenter.state.messages.length, 0);
  assert.equal(noCenter.state.errors.length, 1);

  const badAddress = harness({ resolveAddress: async () => ({
    label: "Endereço não identificado", components: {},
  }) });
  await badAddress.handler();
  assert.equal(badAddress.state.destinations.length, 0);
  assert.equal(badAddress.state.history.length, 0);
  assert.equal(badAddress.state.messages.length, 0);
  assert.equal(badAddress.state.picking, true);
  assert.equal(badAddress.state.errors.length, 1);
});

test("INV-065: map moves during reverse lookup => stale center cannot save", async () => {
  const pending = deferred();
  const h = harness({ resolveAddress: () => pending.promise });
  const task = h.handler();
  h.selectionCenterRef.current = { lat: -9.5, lng: -40.7 };
  pending.resolve({ label: "Destino A", address: "Rua A" });
  await task;
  assert.equal(h.state.history.length, 0);
  assert.equal(h.state.destinations.length, 0);
  assert.equal(h.state.messages.length, 0);
  assert.equal(h.state.picking, true);
  assert.equal(h.state.errors.length, 1);
});

test("INV-065: double-tap is blocked synchronously", async () => {
  const pending = deferred();
  let invokes = 0;
  const h = harness({ resolveAddress: () => { invokes += 1; return pending.promise; } });
  const a = h.handler(), b = h.handler();
  assert.equal(invokes, 1);
  assert.equal(h.mapConfirmBusyRef.current, true);
  pending.resolve({ label: "Destino B", address: "Rua B" });
  await Promise.all([a, b]);
  assert.equal(h.state.destinations.length, 1);
  assert.equal(h.mapConfirmBusyRef.current, false);
});

test("INV-065: native and JavaScript maps provide actual settled camera signals", () => {
  for (const marker of [
    "APOIS_REPORT12_MAP_CAMERA_V1",
    "setOnCameraIdleListener", "setOnCameraMoveStartedListener",
    'pickerMap.addListener("idle"', 'pickerMap.addListener("dragstart"',
    "selectionMode || !nativeModeRef.current",
  ]) assert.ok(map.includes(marker), "picker map camera contract missing " + marker);
  assert.ok(route.includes("onSelectionCenterChange={onMapSelectionCameraIdle}"));
  assert.ok(route.includes("disabled={!mapSelectionCenter || isResolvingMapSelection}"));
  assert.ok(types.includes('source: "google_places" | "map_selection"'));
  assert.ok(route.includes('data-apois-places-error-v2'));
  assert.ok(route.includes('data-apois-favorite-save-mode="true"'));
});
