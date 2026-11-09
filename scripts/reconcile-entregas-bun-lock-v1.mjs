// INV-012 — deterministic, minimal Bun lock overlay for the immutable Entregas pin.
// Only rewrites the COPY in .work; source submodules are never edited.
// Package records were independently cross-checked in five public Bun v1 locks.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { diffManifestAndBunLock, stripJsonTrailingCommas } from "./verify-entregas-bun-lock-v1.mjs";

const CAPACITOR_LOGIN = Object.freeze({
  "@capacitor/app": [
    "@capacitor/app@8.0.0",
    "",
    { peerDependencies: { "@capacitor/core": ">=8.0.0" } },
    "sha512-OwzIkUs4w433Bu9WWAEbEYngXEfJXZ9Wmdb8eoaqzYBgB0W9/3Ed/mh6sAYPNBAZlpyarmewgP7Nb+d3Vrh+xA==",
  ],
  "@capacitor/browser": [
    "@capacitor/browser@8.0.0",
    "",
    { peerDependencies: { "@capacitor/core": ">=8.0.0" } },
    "sha512-xey7maszGABKuStvXDV4vXN+EzIyz0o7zlyzw4JKG6o/1GzqeqHqVuE+8Ux+Hks3DZji4LoriWZVgVF6mR6RGg==",
  ],
});
const EXPECTED = Object.keys(CAPACITOR_LOGIN).sort();

export function reconcileEntregasBunLock(manifest, original) {
  if (!manifest || !original || original.lockfileVersion !== 1 || original.configVersion !== 1)
    throw Error("[FAIL] INV-012 requires the known Bun text-lock v1 format");
  if (!original.workspaces?.[""]?.dependencies || !original.packages)
    throw Error("[FAIL] INV-012 unexpected or incomplete Bun lock structure");
  if (manifest.dependencies?.["@capacitor/app"] !== "8.0.0"
    || manifest.dependencies?.["@capacitor/browser"] !== "8.0.0"
    || manifest.dependencies?.["@capacitor/core"] !== "8.4.2")
    throw Error("[FAIL] INV-012 pinned Capacitor versions changed; review required");
  if (original.packages["@capacitor/core"]?.[0] !== "@capacitor/core@8.4.2")
    throw Error("[FAIL] INV-012 Capacitor core resolution changed; review required");

  const differences = diffManifestAndBunLock(manifest, original);
  const missing = differences
    .filter(d => d.section === "dependencies" && d.declared === "8.0.0" && d.locked === null)
    .map(d => d.name).sort();
  if (differences.length !== missing.length
      || JSON.stringify(missing) !== JSON.stringify(differences.length ? EXPECTED : []))
    throw Error("[FAIL] INV-012 unexpected manifest/lock drift; do not auto-rewrite it");

  // Require exact known package metadata, even when a lock has a matching
  // workspace declaration; tampered or stale integrity must not pass.
  for (const name of EXPECTED) {
    const record = original.packages[name];
    if (record !== undefined && JSON.stringify(record) !== JSON.stringify(CAPACITOR_LOGIN[name]))
      throw Error("[FAIL] INV-012 unexpected package resolution for " + name);
  }

  if (differences.length === 0) {
    for (const name of EXPECTED)
      if (!original.packages[name]) throw Error("[FAIL] INV-012 missing resolved package " + name);
    return { lock: original, changed: false };
  }

  const next = structuredClone(original);
  for (const name of EXPECTED) {
    if (next.packages[name] !== undefined)
      throw Error("[FAIL] INV-012 package record already present without root declaration");
    next.workspaces[""].dependencies[name] = "8.0.0";
    next.packages[name] = structuredClone(CAPACITOR_LOGIN[name]);
  }
  next.workspaces[""].dependencies = Object.fromEntries(
    Object.entries(next.workspaces[""].dependencies).sort(([a], [b]) => a.localeCompare(b, "en")),
  );
  next.packages = Object.fromEntries(
    Object.entries(next.packages).sort(([a], [b]) => a.localeCompare(b, "en")),
  );
  if (diffManifestAndBunLock(manifest, next).length)
    throw Error("[FAIL] INV-012 overlay still differs from package manifest");
  return { lock: next, changed: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
  const workspace = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
  const protectedSource = resolve(root, "sources/apois-entregas");
  if (workspace === protectedSource || workspace.startsWith(protectedSource + sep))
    throw Error("[FAIL] INV-012 may never modify source submodule");
  const path = resolve(workspace, "bun.lock");
  const manifest = JSON.parse(readFileSync(resolve(workspace, "package.json"), "utf8"));
  const lock = JSON.parse(stripJsonTrailingCommas(readFileSync(path, "utf8")));
  const { lock: patched, changed } = reconcileEntregasBunLock(manifest, lock);
  if (changed) {
    const output = JSON.stringify(patched, null, 2) + "\n";
    const parsed = JSON.parse(output);
    if (diffManifestAndBunLock(manifest, parsed).length)
      throw Error("[FAIL] INV-012 serialized overlay failed roundtrip");
    writeFileSync(path, output, "utf8");
    console.log("[OK] INV-012: pinned Capacitor app/browser lock overlay applied ONLY to isolated workspace.");
  } else {
    console.log("[OK] INV-012: overlay already reconciled, no changes.");
  }
}
