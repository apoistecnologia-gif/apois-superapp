// INV-012 — validate the pinned Entregas manifest against its Bun lock.
// Read-only; no network, install, source snapshot mutation or dependency update.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function stripJsonTrailingCommas(input) {
  // Bun's text lock allows trailing commas. Preserve quoted strings verbatim.
  let output = "";
  let quoted = false;
  let escaped = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      output += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      output += ch;
      continue;
    }
    if (ch === ",") {
      let j = i + 1;
      while (j < input.length && /\s/.test(input[j])) j++;
      if (input[j] === "]" || input[j] === "}") continue;
    }
    output += ch;
  }
  return output;
}

export function diffManifestAndBunLock(manifest, lock) {
  const root = lock?.workspaces?.[""];
  if (!root || typeof root !== "object") throw new Error("bun.lock lacks root workspace");
  const sections = ["dependencies", "devDependencies", "optionalDependencies"];
  const mismatches = [];
  for (const section of sections) {
    const expected = manifest[section] ?? {};
    const actual = root[section] ?? {};
    for (const name of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
      if (expected[name] !== actual[name]) {
        mismatches.push({ section, name, declared: expected[name] ?? null, locked: actual[name] ?? null });
      }
    }
  }
  return mismatches;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspace = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
  const manifest = JSON.parse(readFileSync(resolve(workspace, "package.json"), "utf8"));
  const lock = JSON.parse(stripJsonTrailingCommas(readFileSync(resolve(workspace, "bun.lock"), "utf8")));
  const differences = diffManifestAndBunLock(manifest, lock);
  if (differences.length > 0) {
    console.error("[FAIL] INV-012: Entregas Bun lock differs from pinned manifest:");
    for (const d of differences) {
      console.error("  " + d.section + "/" + d.name + ": manifest=" + (d.declared ?? "(absent)") + " lock=" + (d.locked ?? "(absent)"));
    }
    if (process.argv.includes("--qa-fixture-only")) {
      console.warn("[WARN] INV-012: explicit local QA fixture only; never accept as reproducible release.");
    } else {
      process.exitCode = 1;
    }
  } else {
    console.log("[OK] INV-012: Entregas manifest root dependencies match bun.lock.");
  }
}
