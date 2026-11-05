// AF-01: read-only cross-pipeline backend identity test.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const isolated = readFileSync("scripts/build-motorista-module.mjs", "utf8");
const partner = readFileSync("scripts/build-partner-release.sh", "utf8");
const canonical = "tbbzkrfupmqdywnzgnms.supabase.co";
assert.ok(isolated.includes(canonical), "Isolated build must reject noncanonical Supabase Corridas");
assert.ok(partner.includes(canonical), "Partner build must reject noncanonical Supabase Corridas");
assert.ok(isolated.includes("new URL(corridasUrl).hostname"), "Isolated project match must use host exactness");
assert.ok(!isolated.includes("vqtucstyduxrqjgyigfk.supabase.co"), "Old project cannot be selected by isolated build");
assert.ok(partner.includes("require_contains 'tbbzkrfupmqdywnzgnms.supabase.co' dist/client"), "Partner bundle must contain current project");
console.log("[PASS] Motorista: isolated and partner pipelines enforce canonical Corridas project.");
