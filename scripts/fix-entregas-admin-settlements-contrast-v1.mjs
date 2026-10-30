import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Visual-only: improve existing Finance/Admin settlement table, not its data or actions.
const file=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas","src/components/AdminCourierSettlementsPanel.tsx");
if(!existsSync(file))throw Error("[FAIL] AdminCourierSettlementsPanel source missing");
const original=readFileSync(file,"utf8");
let updated=original;
for(const [before,after] of [
 ["text-zinc-600","text-[#CBD5E1]"],
 ["text-zinc-500","text-[#CBD5E1]"],
 ["text-[10px]","text-xs"]
]){
 if(!updated.includes(before) && !updated.includes(after))
  throw Error("[FAIL] Settlement metadata format missing: "+before);
 updated=updated.split(before).join(after);
}
for(const marker of [
 "onClick={() => setFilter(id)}",
 "onClick={() => void load(true)}",
 "resolveDispute(settlement)",
 "settlement.total_amount",
 "settlement.due_at",
 "settlement.delivery_count",
 "settlement.proof_storage_path",
 "settlement.effective_status",
 "STATUS_LABEL[settlement.effective_status]",
 "overflow-x-auto",
 "supabase"
]){
 if(!original.includes(marker)||!updated.includes(marker))
  throw Error("[FAIL] Settlement financial/filter/role behavior not preserved: "+marker);
}
for(const legacy of ["text-zinc-600","text-zinc-500","text-[10px]"])
 if(updated.includes(legacy))throw Error("[FAIL] Settlement low-contrast/small labels remain: "+legacy);
if(updated!==original)writeFileSync(file,updated,"utf8");
console.log("[OK] Admin settlement labels/status/term contrast readable; finance totals, proof and dispute resolution intact");
