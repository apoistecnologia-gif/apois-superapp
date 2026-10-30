import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const file=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas","src/components/AdminCoveragePanel.tsx");
if(!existsSync(file))throw Error("[FAIL] AdminCoveragePanel not found");
const before=readFileSync(file,"utf8");
let after=before;
for(const [a,b] of [["<div className=\"space-y-6\">","<div data-apois-coverage-contrast-v1 className=\"space-y-6\">"],["text-[10px] font-bold uppercase text-zinc-600","text-xs font-bold uppercase text-[#CBD5E1]"],["text-[10px] leading-relaxed text-zinc-600","text-xs leading-relaxed text-[#CBD5E1]"],["text-zinc-500","text-[#CBD5E1]"]]){
 if(after.includes(b) && !after.includes(a))continue;
 if(!after.includes(a))throw Error("[FAIL] Coverage component structure changed: "+a);
 after=after.split(a).join(b);
}
for(const marker of ["data-apois-coverage-contrast-v1","default_delivery_radius_km","courier_dispatch_radius_km","geojson","supabase","loadZones","selectedCityId","useConfirmDialog"]){
 if(!after.includes(marker))throw Error("[FAIL] Admin coverage data/edit behavior missing: "+marker);
}
if(after.includes("text-zinc-600")||after.includes("text-zinc-500"))
 throw Error("[FAIL] Admin coverage retains inaccessible dark labels");
if(after!==before)writeFileSync(file,after,"utf8");
console.log("[OK] Admin coverage: 12px labels and readable light copy on dark operational cards, geojson/zone/radius behavior retained.");
