// Report 1 / OBS-011: run the real Driver history transforms on a throwaway
// copy of the protected pinned route. No Supabase or other side effects.
import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const originalPath = resolve(root, "sources/apois-corridas-motorista-admin/src/routes/motorista.corridas.tsx");
const scripts = [
  "scripts/harden-motorista-history-recovery.mjs",
  "scripts/fix-motorista-history-cursor-v1.mjs",
];

test("Driver history loads beyond 50 using owner-scoped stable cursor", () => {
  assert.ok(existsSync(originalPath), "pinned Motorista source submodule must be initialized");
  const original = readFileSync(originalPath, "utf8");
  const workspace = mkdtempSync(join(tmpdir(), "apois-driver-history-"));
  try {
    const target = resolve(workspace, "src/routes/motorista.corridas.tsx");
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(originalPath, target);

    function apply(script) {
      const result = spawnSync(process.execPath, [resolve(root, script)], {
        cwd: root, encoding: "utf8",
        env: { ...process.env, APOIS_MOTORISTA_WORKSPACE: workspace },
      });
      assert.equal(result.status, 0, script + ": " + result.stderr + result.stdout);
    }

    for (const script of scripts) apply(script);
    const generated = readFileSync(target, "utf8");
    assert.match(generated, /APOIS_MOTORISTA_HISTORY_CURSOR_V1/);
    assert.match(generated, /APOIS_MOTORISTA_HISTORICO_ASYNC_RECOVERY_V1/);
    assert.match(generated, /\.eq\("driver_id", driverId\)/);
    assert.match(generated, /\.or\(cursorFilter\)/);
    assert.match(generated, /\.order\("id", \{ ascending: false \}\)/);
    assert.match(generated, /\.limit\(51\)/);
    assert.match(generated, /Carregar corridas anteriores/);
    assert.match(generated, /setRides\(existing =>/);
    assert.match(generated, /currentProfile.profile.id !== driverId/);
    assert.doesNotMatch(generated, /\.limit\(50\)/);

    for (const script of scripts) apply(script);
    assert.equal(readFileSync(target, "utf8"), generated, "patches must be idempotent");
    assert.equal(readFileSync(originalPath, "utf8"), original, "source snapshot must not change");
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
