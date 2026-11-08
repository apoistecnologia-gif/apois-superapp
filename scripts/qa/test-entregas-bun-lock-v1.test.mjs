// INV-012 — isolated Node tests for the manifest/lock integrity gate.
import test from "node:test";
import assert from "node:assert/strict";
import { diffManifestAndBunLock, stripJsonTrailingCommas } from "../verify-entregas-bun-lock-v1.mjs";

test("Bun lock parser accepts trailing commas without corrupting quoted strings", () => {
  const raw = '{"workspaces":{"":{"dependencies":{"a":"x,}y",},"devDependencies":{},},},}';
  const parsed = JSON.parse(stripJsonTrailingCommas(raw));
  assert.equal(parsed.workspaces[""].dependencies.a, "x,}y");
});

test("lock detection catches missing required Capacitor login dependencies", () => {
  const manifest = {
    dependencies: { "@capacitor/app": "8.0.0", "@capacitor/browser": "8.0.0" },
  };
  const lock = { workspaces: { "": { dependencies: {} } } };
  const names = diffManifestAndBunLock(manifest, lock).map((entry) => entry.name);
  assert.deepEqual(names.sort(), ["@capacitor/app", "@capacitor/browser"]);
});

test("mismatched versions and unaccounted lock packages are rejected", () => {
  const manifest = { dependencies: { react: "19.2.0" } };
  const lock = { workspaces: { "": { dependencies: { react: "18.0.0", extra: "1.0.0" } } } };
  const diffs = diffManifestAndBunLock(manifest, lock);
  assert.equal(diffs.length, 2);
  assert.equal(diffs.find((d) => d.name === "react")?.locked, "18.0.0");
  assert.equal(diffs.find((d) => d.name === "extra")?.declared, null);
});

test("matched dependency versions are accepted without editing lockfiles", () => {
  const manifest = {
    dependencies: { react: "19.2.0" },
    devDependencies: { typescript: "~5.9.0" },
  };
  const lock = { workspaces: { "": {
    dependencies: { react: "19.2.0" },
    devDependencies: { typescript: "~5.9.0" },
  } } };
  assert.deepEqual(diffManifestAndBunLock(manifest, lock), []);
});

test("missing root workspace is an explicit failure", () => {
  assert.throws(() => diffManifestAndBunLock({}, { workspaces: {} }), /root workspace/);
});
