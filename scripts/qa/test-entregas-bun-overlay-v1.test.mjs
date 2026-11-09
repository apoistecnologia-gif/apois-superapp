// INV-012: prove deterministic Capacitor 8.0.0 lock repair on immutable source.
// The tests never fetch packages, invoke Bun, change Git refs or use real auth.
import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { reconcileEntregasBunLock } from "../reconcile-entregas-bun-lock-v1.mjs";
import { diffManifestAndBunLock, stripJsonTrailingCommas } from "../verify-entregas-bun-lock-v1.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = resolve(root, "sources/apois-entregas");
const clone = x => JSON.parse(JSON.stringify(x));

function fixture() {
  const manifestText = readFileSync(resolve(source, "package.json"), "utf8");
  const lockText = readFileSync(resolve(source, "bun.lock"), "utf8");
  return {
    manifest: JSON.parse(manifestText),
    lock: JSON.parse(stripJsonTrailingCommas(lockText)),
    manifestText,
    lockText,
  };
}

test("original Entregas pin differs only in two native Google-login packages", () => {
  const { manifest, lock } = fixture();
  assert.deepEqual(
    diffManifestAndBunLock(manifest, lock).map(item => item.name).sort(),
    ["@capacitor/app", "@capacitor/browser"],
  );
});

test("repaired lock is exact, stable and includes cross-verified integrity records", () => {
  const { manifest, lock } = fixture();
  const original = clone(lock);
  const { lock: repaired, changed } = reconcileEntregasBunLock(manifest, lock);
  assert.equal(changed, true);
  assert.deepEqual(diffManifestAndBunLock(manifest, repaired), []);
  assert.equal(repaired.packages["@capacitor/app"][0], "@capacitor/app@8.0.0");
  assert.equal(repaired.packages["@capacitor/browser"][0], "@capacitor/browser@8.0.0");
  assert.equal(repaired.packages["@capacitor/app"][3],
    "sha512-OwzIkUs4w433Bu9WWAEbEYngXEfJXZ9Wmdb8eoaqzYBgB0W9/3Ed/mh6sAYPNBAZlpyarmewgP7Nb+d3Vrh+xA==");
  assert.equal(repaired.packages["@capacitor/browser"][3],
    "sha512-xey7maszGABKuStvXDV4vXN+EzIyz0o7zlyzw4JKG6o/1GzqeqHqVuE+8Ux+Hks3DZji4LoriWZVgVF6mR6RGg==");
  assert.deepEqual(lock, original, "repair must not mutate source lock object");
  const again = reconcileEntregasBunLock(manifest, repaired);
  assert.equal(again.changed, false);
  assert.deepEqual(again.lock, repaired);
  assert.deepEqual(JSON.parse(JSON.stringify(repaired)), repaired);
});

test("fails closed on unexpected drift or tampered package integrity", () => {
  const { manifest, lock } = fixture();
  const badManifest = clone(manifest);
  badManifest.dependencies["unknown-package"] = "^1";
  assert.throws(() => reconcileEntregasBunLock(badManifest, lock), /unexpected manifest\/lock drift/);
  const badCore = clone(manifest);
  badCore.dependencies["@capacitor/core"] = "9.0.0";
  assert.throws(() => reconcileEntregasBunLock(badCore, lock), /pinned Capacitor versions changed/);
  const patched = reconcileEntregasBunLock(manifest, lock).lock;
  const badIntegrity = clone(patched);
  badIntegrity.packages["@capacitor/app"][3] = "sha512-invalid";
  assert.throws(() => reconcileEntregasBunLock(manifest, badIntegrity), /unexpected package resolution/);
  const incomplete = clone(patched);
  delete incomplete.packages["@capacitor/browser"];
  assert.throws(() => reconcileEntregasBunLock(manifest, incomplete), /missing resolved package/);
});

test("CLI writes only disposable workspace and is idempotent on second run", () => {
  const { manifestText, lockText } = fixture();
  const workspace = mkdtempSync(join(tmpdir(), "apois-entregas-bun-lock-"));
  const lockPath = resolve(workspace, "bun.lock");
  try {
    writeFileSync(resolve(workspace, "package.json"), manifestText);
    writeFileSync(lockPath, lockText);
    const command = resolve(root, "scripts/reconcile-entregas-bun-lock-v1.mjs");
    const invoke = () => spawnSync(process.execPath, [command], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, APOIS_ENTREGAS_WORKSPACE: workspace },
    });
    const first = invoke();
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const once = readFileSync(lockPath, "utf8");
    const parsed = JSON.parse(once);
    assert.deepEqual(diffManifestAndBunLock(JSON.parse(manifestText), parsed), []);
    const second = invoke();
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(readFileSync(lockPath, "utf8"), once, "second run must not alter lock bytes");
    assert.equal(readFileSync(resolve(source, "bun.lock"), "utf8"), lockText,
      "original pinned submodule lock must not be touched");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
