import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Presentation-only patch for the Admin Orders panel, applied to the isolated WEB build.
const file=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas","src/components/AdminOrdersPanel.tsx");
if(!existsSync(file))throw Error("[FAIL] Admin Orders panel missing");
const original=readFileSync(file,"utf8");
let updated=original;
const replacements=[["text-[10px] font-black uppercase text-zinc-600","text-xs font-black uppercase text-[#CBD5E1]"],["mt-1 font-mono text-[9px] text-zinc-700","mt-1 font-mono text-xs text-[#CBD5E1]"],["text-[9px] font-black uppercase tracking-wide text-zinc-700","text-xs font-black uppercase tracking-wide text-[#CBD5E1]"],["text-[10px] text-zinc-600","text-[11px] text-[#CBD5E1]"],["text-zinc-600","text-[#CBD5E1]"]];
for(const [before,after] of replacements){
 if(updated.includes(before))updated=updated.split(before).join(after);
 else if(!updated.includes(after))throw Error("[FAIL] Orders visual target absent: "+before.slice(0,88));
}
const required=["setQuery(event.target.value)","setStatusFilter(event.target.value)","setPaymentFilter(event.target.value)","setCityFilter(event.target.value)","setDateFrom(event.target.value)","setDateTo(event.target.value)","toggleOrder(order)","selectedOrderId === order.id","timeline.map((entry)","money(order.platform_fee ?? order.service_fee)","money(order.courier_earnings ?? selectedJob?.estimated_earnings)"];
for(const value of required){
 if(!original.includes(value)||!updated.includes(value))throw Error("[FAIL] Admin Orders control or financial value lost: "+value);
}
for(const legacy of ["text-zinc-600","text-zinc-700","text-[9px]"]){
 if(updated.includes(legacy))throw Error("[FAIL] Admin Orders inaccessible legacy text remains: "+legacy);
}
if(!updated.includes('text-xs font-black uppercase text-[#CBD5E1]') || !updated.includes('font-mono text-xs text-[#CBD5E1]'))
 throw Error("[FAIL] Admin Orders label sizing/contrast not applied");
if(updated!==original)writeFileSync(file,updated,"utf8");
console.log("[OK] Admin Orders labels, order IDs and timeline readable; queries, filters and financial computations untouched");
