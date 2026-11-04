import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const manifestPath = resolve(root, "docs/edge-function-release-classification.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const allowed = new Set([
  "RETIRED_FAIL_CLOSED",
  "HISTORICAL_ONLY",
  "REQUIRED_NON_FINANCIAL",
  "WEBHOOK_RETIRED",
  "OAUTH_RETIRED",
  "UNKNOWN_NEEDS_REVIEW",
]);
const retired = new Set(["RETIRED_FAIL_CLOSED", "WEBHOOK_RETIRED", "OAUTH_RETIRED"]);
let failed = false;
function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }

const projects = manifest.projects ?? {};
const expectedCounts = { corridas: 41, entregas: 38 };
for (const [project, expected] of Object.entries(expectedCounts)) {
  const rows = Array.isArray(projects[project]) ? projects[project] : [];
  if (rows.length !== expected) fail(`${project}: esperado ${expected}, encontrado ${rows.length}`); else ok(`${project}: ${expected} Edge Functions classificadas`);
  const seen = new Set();
  for (const row of rows) {
    if (!row?.function || !allowed.has(row?.classification)) { fail(`${project}: registro inválido ${JSON.stringify(row)}`); continue; }
    if (seen.has(row.function)) fail(`${project}: função duplicada ${row.function}`);
    seen.add(row.function);
  }
}

const unknown = Object.values(projects).flat().filter((row) => row.classification === "UNKNOWN_NEEDS_REVIEW");
if (unknown.length) fail(`UNKNOWN_NEEDS_REVIEW ainda presente: ${unknown.map((r) => r.function).join(", ")}`); else ok("nenhuma integração permanece UNKNOWN_NEEDS_REVIEW");

const uniqueRetired = new Map();
for (const rows of Object.values(projects)) {
  for (const row of rows) {
    if (!retired.has(row.classification)) continue;
    const current = uniqueRetired.get(row.function);
    if (current && current !== row.classification) fail(`classificação conflitante para ${row.function}: ${current} x ${row.classification}`); else uniqueRetired.set(row.function, row.classification);
  }
}

for (const [functionName, classification] of uniqueRetired) {
  const path = resolve(root, "supabase/functions", functionName, "index.ts");
  if (!existsSync(path)) { fail(`stub fail-closed ausente: ${functionName}`); continue; }
  const source = readFileSync(path, "utf8");
  if (!source.includes("retiredProvider") || !source.includes("provider_retired")) { fail(`stub inválido: ${functionName}`); continue; }
  if (!source.includes(classification)) { fail(`stub ${functionName} não declara ${classification}`); continue; }
  if (/api\.(mercadopago|asaas)|pagseguro|api\.openpix|\/v1\/payments|oauth\/token/i.test(source)) { fail(`stub ${functionName} ainda contém chamada/provider marker ativo`); continue; }
  ok(`${functionName}: ${classification} fail-closed`);
}

if (failed) process.exit(1);
console.log(`[OK] ${uniqueRetired.size} endpoints legados possuem stub 410 versionado.`);
