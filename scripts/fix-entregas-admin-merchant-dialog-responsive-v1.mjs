import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Scoped presentation patch; protected snapshots are never written.
const file = resolve(
  process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas",
  "src/components/AdminMerchantCreateDialog.tsx",
);
if (!existsSync(file)) throw Error("[FAIL] Admin merchant dialog source missing");
const initial = readFileSync(file, "utf8");
let code = initial;
const styles = [
  [
    "className=\"grid grid-cols-2 gap-2\"",
    "className=\"grid grid-cols-1 gap-2 sm:grid-cols-2 [&>button]:h-auto [&>button]:min-h-10 [&>button]:whitespace-normal [&>button]:py-2\""
  ],
  [
    "className=\"max-h-[90vh] max-w-2xl overflow-y-auto border-zinc-800 bg-zinc-950 text-white\"",
    "className=\"max-h-[90dvh] max-w-2xl overflow-y-auto overscroll-contain border-zinc-800 bg-zinc-950 text-white\""
  ],
  [
    "className=\"text-xs text-zinc-500\"",
    "className=\"break-words text-xs text-[#CBD5E1]\""
  ],
  [
    "className=\"block text-xs text-zinc-500\"",
    "className=\"block text-xs text-[#CBD5E1]\""
  ]
];
for (const [before, after] of styles) {
  const beforeCount = code.split(before).length - 1;
  const afterCount = code.split(after).length - 1;
  if (beforeCount + afterCount !== 1) {
    throw Error("[FAIL] Admin merchant dialog style drift: " + before);
  }
  code = code.replace(before, after);
}
// Reversing only the permitted presentation substitutions must restore every
// byte, including auth options, validation, RPC payload and event handlers.
let restored = code;
for (const [before, after] of styles) {
  if (initial.includes(before)) restored = restored.replace(after, before);
}
if (restored !== initial) throw Error("[FAIL] Non-presentation dialog change");
if (code !== initial) writeFileSync(file, code, "utf8");
console.log("[OK] Admin merchant dialog: responsive mode buttons and readable metadata; auth/RPC unchanged");
