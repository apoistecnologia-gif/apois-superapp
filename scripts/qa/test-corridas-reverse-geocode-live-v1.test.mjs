// Report 1: real generator and parser QA against pinned Corridas geocoding source.
// Runs after Bun install so TypeScript resolves from the isolated workspace.
// No network calls, no Google charges, no production writes.
import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const pinned = resolve(root,
  "sources/apois-corridas-passageiro/src/services/geocoding/geocoding-service.ts");
const localTS = createRequire(resolve(root, ".work/corridas/package.json"))("typescript");

const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value);
const readString = (source, key) =>
  typeof source[key] === "string" && source[key].trim() ? source[key] : undefined;

function makeFixture() {
  const workspace = mkdtempSync(join(tmpdir(), "apois-live-reverse-"));
  const route = resolve(workspace, "src/services/geocoding/geocoding-service.ts");
  mkdirSync(dirname(route), { recursive: true });
  copyFileSync(pinned, route);
  const original = readFileSync(pinned, "utf8");
  const generator = resolve(root, "scripts/fix-corridas-reverse-geocode-live-v1.mjs");
  function apply() {
    const result = spawnSync(process.execPath, [generator], {
      cwd: root, encoding: "utf8",
      env: { ...process.env, APOIS_CORRIDAS_WORKSPACE: workspace },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  apply();
  const next = readFileSync(route, "utf8");
  apply();
  assert.equal(next, readFileSync(route, "utf8"), "must be idempotent");
  assert.equal(readFileSync(pinned, "utf8"), original, "immutable pin changed");
  rmSync(workspace, { recursive: true, force: true });
  return next;
}

function compiledAdapter(code) {
  const begin = code.indexOf("function normalizePublicReverseResult(");
  const end = code.indexOf("class GeocodingService {", begin);
  assert.ok(begin > 0 && end > begin, "missing adapter code");
  const helper = code.slice(begin, end);
  const parsed = localTS.createSourceFile("reverse-helper.ts", helper,
    localTS.ScriptTarget.ES2022, true, localTS.ScriptKind.TS);
  assert.equal(parsed.parseDiagnostics.length, 0,
    "TypeScript parser rejected the generated helper");
  const output = localTS.transpileModule(helper, {
    reportDiagnostics: true,
    compilerOptions: { target: localTS.ScriptTarget.ES2022, module: localTS.ModuleKind.CommonJS },
  });
  assert.equal((output.diagnostics ?? []).filter(d =>
    d.category === localTS.DiagnosticCategory.Error).length, 0);
  return runInNewContext(output.outputText + "\nnormalizePublicReverseResult", {
    isRecord, readString,
  });
}

test("deployed reverse API is used instead of two undeployed functions", () => {
  const code = makeFixture();
  assert.match(code, /APOIS_PUBLIC_REVERSE_GEOCODE_V1/);
  assert.match(code, /"google-maps-address"/);
  assert.match(code, /action: "reverse_geocode", lat: coords\.lat, lng: coords\.lng/);
  assert.doesNotMatch(code, /"passenger-geocode-reverse"/);
  assert.doesNotMatch(code, /"passenger-geocode-nearest-poi"/);
});

test("Google rooftop result preserves street/number, city and precision", () => {
  const normalize = compiledAdapter(makeFixture());
  const payload = normalize({ results: [{
    formatted_address: "Rua das Flores, 35, Petrolina - PE",
    geometry: { location_type: "ROOFTOP" },
    address_components: [
      { long_name: "Rua das Flores", types: ["route"] },
      { long_name: "35", types: ["street_number"] },
      { long_name: "Centro", types: ["neighborhood"] },
      { long_name: "Petrolina", types: ["locality"] },
      { long_name: "Pernambuco", types: ["administrative_area_level_1"] },
    ],
  }]});
  assert.equal(payload.pickupLabel, "Rua das Flores, 35");
  assert.equal(payload.components.rua, "Rua das Flores");
  assert.equal(payload.precision, "exact");
  assert.equal(payload.confidence, "high");
  assert.match(payload.pickupSubLabel, /Petrolina/);
});

test("Photon fallback without geometry is explicitly approximate, not invented GPS", () => {
  const normalize = compiledAdapter(makeFixture());
  const payload = normalize({ results: [{
    formatted_address: "Gameleira, Picos, Piauí",
    address_components: [
      { long_name: "Gameleira", types: ["sublocality_level_1"] },
      { long_name: "Picos", types: ["locality"] },
      { long_name: "Piauí", types: ["administrative_area_level_1"] },
    ],
  }]});
  assert.equal(payload.pickupLabel, "Gameleira");
  assert.equal(payload.approximate, true);
  assert.equal(payload.precision, "approximate");
  assert.equal(payload.components.cidade, "Picos");
});

test("POI is only surfaced when provider actually labels a POI", () => {
  const normalize = compiledAdapter(makeFixture());
  const payload = normalize({ results: [{
    formatted_address: "Mercado Municipal, Petrolina, Pernambuco",
    types: ["point_of_interest"],
    address_components: [{long_name:"Petrolina",types:["locality"]}],
  }]});
  assert.equal(payload.nearestPoi, "Mercado Municipal");
  assert.match(payload.pickupSubLabel, /Mercado Municipal/);
  assert.throws(() => normalize({ results: [] }), /geocode_empty_result/);
  assert.throws(() => normalize({ unsupported: true }), /geocode_invalid_response/);
});
