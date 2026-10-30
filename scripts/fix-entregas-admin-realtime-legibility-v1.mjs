import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas", "src/components/AdminRealtimeOperationsPanel.tsx");
if(!existsSync(path))throw Error("[FAIL] Admin live operations panel missing");
const before=readFileSync(path,"utf8");
let after=before;
for(const [from,to] of [["bg-black text-[10px] uppercase tracking-wide text-zinc-500","bg-black text-xs font-bold uppercase tracking-wide text-[#CBD5E1]"],["text-[10px] font-black uppercase text-zinc-500","text-xs font-black uppercase text-[#CBD5E1]"],["text-[10px] text-zinc-600","text-xs text-[#CBD5E1]"],["text-[10px] font-bold text-red-300","text-xs font-bold text-red-300"]]){
 if(after.includes(from))after=after.split(from).join(to);
 else if(!after.includes(to))throw Error("[FAIL] Admin live operations visual target not found: "+from);
}
for(const marker of ["from(\"delivery_jobs\")","from(\"courier_availability\")","from(\"courier_locations\")","<GoogleMap","<APIProvider apiKey={browserKey}>","onlineLocations.map((location)","onClick={() => void load(true)}"]){
 if(!before.includes(marker)||!after.includes(marker))throw Error("[FAIL] Live operations data, map or refresh changed: "+marker);
}
if(after.includes('text-[10px] text-zinc-600') || after.includes('bg-black text-[10px] uppercase tracking-wide text-zinc-500'))
 throw Error("[FAIL] Live operations tiny/low-contrast labels remain");
if(after!==before)writeFileSync(path,after,"utf8");
console.log("[OK] Admin live operations dates/table headers and online map labels readable; data queries and maps preserved");
