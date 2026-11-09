import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

// Static/synthetic test only: no app runtime, login, APIs, Maps or real ride.
const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const patch = resolve(root, "scripts/fix-corridas-visual04-passenger-v1.mjs");
const searchPath = "src/routes/_authenticated.buscar-destino.tsx";
const reviewPath = "src/routes/_authenticated.revisar-solicitacao.tsx";
const searchFixture = [
  "function BuscarDestinoPage() {",
  '  const handleFinalSelection = (details) => { setDestination(details); };',
  '  const handleSelectSuggestion = (suggestion) => {};',
  '  const setQuery = (value) => {};',
  "  return <div>",
  '    <input onChange={(e) => setQuery(e.target.value)} />',
  '    {query && (<button onClick={clearQuery} className="absolute right-4 p-1 text-gray-400"><X /></button>)}',
  "    {suggestions.map((suggestion) => <div key={suggestion.placeId} />)}",
  "    {handleFinalSelection(details)}",
  "  </div>;",
  "}",
].join("\n");
const reviewFixture = [
  "function RideRequestReviewPage() {",
  '  const response = await confirmRide(comfort);',
  "  const canSubmit = checkout.readiness;",
  "  return <div>",
  "    {selectedCategory?.details && Object.keys(selectedCategory.details).length > 0 && (",
  "      <section>",
  "        {Object.entries(selectedCategory.details).map(([key, value]) => (",
  '          <div key={key}><p className="text-[9px] uppercase">{key.replace(/([A-Z])/g, " ")}</p>',
  '          <p className="text-xs font-bold capitalize">{String(value)}</p></div>',
  "        ))}",
  "      </section>",
  "    )}",
  "    <p>{checkout.finalTotal}</p>",
  "    <p>O valor oficial será confirmado pelo servidor ao solicitar.</p>",
  "  </div>;",
  "}",
].join("\n");

function save(base, relative, content) {
  const p = join(base, relative);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
}
function read(base, relative) { return readFileSync(join(base, relative), "utf8"); }

test("CV-016/017: visual-only transform is idempotent and fail-closed", () => {
  const temp = mkdtempSync(join(tmpdir(), "apois-cv04-"));
  const workspace = join(temp, ".work/corridas");
  const run = () => spawnSync(process.execPath, [patch], {
    cwd: temp, encoding: "utf8",
    env: { ...process.env, APOIS_CORRIDAS_WORKSPACE: workspace },
  });
  try {
    save(workspace, searchPath, searchFixture);
    save(workspace, reviewPath, reviewFixture);
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    const search = read(workspace, searchPath);
    const review = read(workspace, reviewPath);
    assert.match(search, /aria-label="Limpar busca"/);
    assert.match(search, /title="Limpar busca"/);
    assert.match(search, /h-11 w-11/);
    assert.match(search, /focus-visible:outline/);
    assert.match(search, /onClick=\{clearQuery\}/);
    assert.match(search, /handleFinalSelection\(details\)/);
    assert.match(search, /suggestions\.map/);
    assert.match(review, /APOIS_VISUAL04_REVIEW_DETAILS_V1/);
    assert.match(review, /Object\.entries\(selectedCategory\.details\)\.map/);
    assert.match(review, /formatApoisReviewDetailLabel\(key\)/);
    assert.match(review, /formatApoisReviewDetailValue\(value, key\)/);
    assert.doesNotMatch(review, /\{String\(value\)\}/);
    assert.match(review, /const response = await confirmRide\(comfort\)/);
    assert.match(review, /checkout\.finalTotal/);
    assert.match(review, /O valor oficial será confirmado pelo servidor ao solicitar/);
    for (const token of [
      "ride_comfort_preferences", "conversation", "music", "air_conditioning",
      "Object.entries(value as Record<string, unknown>)",
      "typeof value === \"boolean\"", "Array.isArray(value)",
      "apoisReviewDetailChoices[key]?.[value] ?? value",
    ]) assert.ok(review.includes(token), "Keep contract: " + token);
    result = run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(read(workspace, searchPath), search, "Search patch idempotence");
    assert.equal(read(workspace, reviewPath), review, "Review patch idempotence");
    save(workspace, searchPath, searchFixture.replace("onClick={clearQuery}", "onClick={changed}"));
    result = run();
    assert.notEqual(result.status, 0, "unexpected callback must not be patched");
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test("CV-018: final-return timer is unchanged and restricted to completed ride", () => {
  const f = readFileSync(resolve(root, "scripts/fix-corridas-client-comfort-finish-v2.mjs"), "utf8");
  assert.match(f, /finishHomeActionRef\.current\(\), 3200/);
  assert.match(f, /screenState !== \\"completed\\"/);
  assert.match(f, /ride\.id !== rideId/);
  const visual = readFileSync(patch, "utf8");
  assert.doesNotMatch(visual, /setTimeout\s*\(/);
  assert.doesNotMatch(visual, /handleReturnHome\s*\(/);
});

test("CV-04: patch is ordered after all Corridas checkout transforms", () => {
  const b = readFileSync(resolve(root, "scripts/build-isolated-module.mjs"), "utf8");
  const old = b.indexOf("fix-report09-pricing-checkout-v1.mjs");
  const visual = b.indexOf("fix-corridas-visual04-passenger-v1.mjs");
  assert.ok(old >= 0 && visual > old, "apply visual last");
});
