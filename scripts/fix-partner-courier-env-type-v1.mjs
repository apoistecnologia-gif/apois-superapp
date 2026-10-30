import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador");
const file = resolve(root, "src/routes/courier.tsx");
if (!existsSync(file)) throw new Error("[FAIL] Courier route missing before typecheck");
const before = readFileSync(file, "utf8");
// Vite's ImportMetaEnv is index-signature typed: TS4111 requires bracket access.
// This is a syntax-only fix; neither the environment value nor its behavior changes.
const oldRef = "import.meta.env.VITE_SUPABASE_URL";
const safeRef = 'import.meta.env["VITE_SUPABASE_URL"]';
if (!before.includes(oldRef) && !before.includes(safeRef)) {
  throw new Error("[FAIL] Courier URL environment reference missing");
}
const after = before.replaceAll(oldRef, safeRef);
if (after !== before) writeFileSync(file, after, "utf8");
if (!after.includes(safeRef) || after.includes(oldRef)) {
  throw new Error("[FAIL] Courier Vite environment access still incompatible with TS4111");
}
console.log("[OK] Courier VITE_SUPABASE_URL uses type-safe bracket access");
