import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Visual-only, isolated web build: no Supabase or review business-rule changes.
const file=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas","src/components/AdminReviewsPanel.tsx");
if(!existsSync(file))throw Error("[FAIL] AdminReviewsPanel missing");
const original=readFileSync(file,"utf8");
let updated=original;
for(const [before,after] of [
  ["text-zinc-600","text-[#CBD5E1]"],
  ["text-zinc-700","text-[#CBD5E1]"],
  ["text-[10px]","text-xs"]
]){
  if(!updated.includes(before) && !updated.includes(after))throw Error("[FAIL] Review label format missing: "+before);
  updated=updated.split(before).join(after);
}
for(const marker of [
 "setQuery(event.target.value)",
 "setFilter(id as typeof filter)",
 "filter === id",
 "onClick={() => void load(true)}",
 "review.merchant_rating",
 "review.courier_rating",
 "review.customer_user_id",
 "review.comment",
 "courierById.get(review.courier_id)",
 "critical ?",
 "supabase"
]){
 if(!original.includes(marker)||!updated.includes(marker))
  throw Error("[FAIL] Admin review operational gate missing: "+marker);
}
for(const old of ["text-zinc-600","text-zinc-700","text-[10px]"]){
 if(updated.includes(old))throw Error("[FAIL] Review small/dark labels remain: "+old);
}
if(updated!==original)writeFileSync(file,updated,"utf8");
console.log("[OK] Admin reviews: readable ratings/labels and empty values, no change in queries/filters/reviews");
