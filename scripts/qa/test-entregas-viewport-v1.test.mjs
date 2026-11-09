import test from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = resolve(root, "sources/apois-entregas");
const viewportScript = resolve(root, "scripts/harden-entregas-superapp-viewport.mjs");

function routeList() {
  const code = readFileSync(viewportScript, "utf8");
  const start = code.indexOf("const files = [");
  const end = code.indexOf("];", start);
  assert.ok(start >= 0 && end > start);
  return [...code.slice(start, end).matchAll(/'([^']+\.tsx)'/g)].map((match) => match[1]);
}

test("viewport correction covers 30 present pinned routes, with one known absent auth route", () => {
  const listed = routeList();
  assert.equal(listed.length, 31, "route coverage drift requires review");
  // The protected source snapshot has no recuperar-senha route; the runtime
  // overlay explicitly skips absent routes. Any OTHER missing route still fails.
  const allowedAbsent = "src/routes/recuperar-senha.tsx";
  const absent = listed.filter(relative => !existsSync(resolve(source, relative)));
  assert.deepEqual(absent, [allowedAbsent], "unexpected source route missing from pinned snapshot");
  const paths = listed.filter(relative => existsSync(resolve(source, relative)));
  assert.equal(paths.length, 30, "viewport route coverage drift");
  const workspace = mkdtempSync(join(tmpdir(), "apois-viewport-"));
  try {
    let originalFixedHeight = 0;
    for (const relative of paths) {
      const original = resolve(source, relative);
      assert.ok(existsSync(original), relative + " missing from pinned snapshot");
      const target = resolve(workspace, relative);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(original, target);
      originalFixedHeight += (readFileSync(original, "utf8").match(/\b(?:min-)?h-screen\b/g) ?? []).length;
    }
    assert.ok(originalFixedHeight > 0, "snapshot no longer has fixed viewport defect; audit baseline");
    const run = () => spawnSync(process.execPath, [viewportScript], {
      cwd: root, encoding: "utf8",
      env: { ...process.env, APOIS_ENTREGAS_WORKSPACE: workspace },
    });
    const first = run();
    assert.equal(first.status, 0, first.stderr || first.stdout);

    const patched = paths.map(relative => readFileSync(resolve(workspace, relative), "utf8"));
    for (let i = 0; i < paths.length; i++) {
      assert.doesNotMatch(patched[i], /\b(?:min-)?h-screen\b/, paths[i] + " fixed 100vh remained");
      assert.equal(readFileSync(resolve(source, paths[i]), "utf8").replaceAll("min-h-screen","min-h-dvh").replaceAll("h-screen","h-dvh"), patched[i],
        paths[i] + " unintended code modification");
    }
    const second = run();
    assert.equal(second.status, 0, second.stderr || second.stdout);
    for (let i = 0; i < paths.length; i++)
      assert.equal(readFileSync(resolve(workspace, paths[i]), "utf8"), patched[i], paths[i] + " not idempotent");

    for (const build of ["build-isolated-module.mjs", "build-merchant-panel.mjs"]) {
      const runner = readFileSync(resolve(root, "scripts", build), "utf8");
      assert.match(runner, /harden-entregas-superapp-viewport\.mjs/, build + " missing critical fix");
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
