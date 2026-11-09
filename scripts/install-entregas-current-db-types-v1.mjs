// Report 01 — refresh generated Entregas Supabase types in isolated workspace.
// The original gitlink sources/apois-entregas and production DB stay unchanged.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";

const root = resolve(".");
const workspace = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
const protectedSource = resolve(root, "sources/apois-entregas");
if (workspace === protectedSource || workspace.startsWith(protectedSource + sep))
  throw Error("[FAIL] Entregas generated types may not write protected source");
const source = resolve(root, "schemas/entregas-production-public.types.ts");
const target = resolve(workspace, "src/integrations/supabase/types.ts");
const generated = readFileSync(source, "utf8");
const old = readFileSync(target, "utf8");

const mustHave = [
  "export type Database",
  "    Tables: {",
  ...[
    "couriers", "delivery_jobs", "merchant_members", "platform_settings",
    "customer_addresses", "reviews", "notification_preferences",
  ].map(table => "      " + table + ": {"),
];
for (const marker of mustHave) {
  if (!generated.includes(marker))
    throw Error("[FAIL] Supabase types generator missing critical schema: " + marker);
}
if (generated.length < 60_000) throw Error("[FAIL] Supabase schema snapshot unexpectedly small");
if (!old.includes("export type Database")) throw Error("[FAIL] unexpected existing Supabase types");
if (generated === old) console.log("[OK] Entregas Supabase types already current.");
else {
  writeFileSync(target, generated, "utf8");
  console.log("[OK] Entregas public schema types updated only in .work copy.");
}
