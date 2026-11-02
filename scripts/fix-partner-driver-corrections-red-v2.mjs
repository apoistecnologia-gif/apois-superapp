import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
// APOIS_DRIVER_CORRECTIONS_RED_V2 — UI only, preserve callbacks and RPCs.
const p=resolve(".work/partner-motorista/src/components/ApoisDriverCorrections.tsx");
let s=readFileSync(p,"utf8");
if(!s.includes("apois_driver_my_corrections")||!s.includes("apois_driver_resubmit_corrections"))throw Error("[FAIL] corrections RPC contract missing");
const map=new Map([
 ["border-amber-400/40","border-[#F2B6B9]"],
 ["bg-[#211A08]","bg-white"],
 ["text-amber-300","text-[#B71922]"],
 ["text-amber-100","text-[#374151]"],
 ["text-zinc-200","text-[#374151]"],
 ["text-zinc-300","text-[#596372]"],
 ["text-zinc-400","text-[#596372]"],
 ["bg-black/40","bg-[#F7F7F8]"],
 ["border-white/10","border-[#E2E4E8]"],
 ["border-white/20","border-[#CDD3DC]"],
 ["bg-amber-300","bg-[#E51B23]"],
 ["text-red-300","text-red-700"],
 ["text-green-300","text-[#166534]"]
]);
for(const [a,b] of map){if(!s.includes(a))throw Error("[FAIL] driver corrections visual source changed "+a);s=s.replaceAll(a,b);}
const darkButton="bg-[#E51B23] text-sm font-extrabold text-black";
if(!s.includes(darkButton))throw Error("[FAIL] correction resubmit button drift");
s=s.replaceAll("bg-[#E51B23] p-3 text-center text-sm font-extrabold text-black",
             "bg-[#E51B23] p-3 text-center text-sm font-extrabold text-white");
s=s.replaceAll("bg-[#E51B23] text-sm font-bold text-black","bg-[#E51B23] text-sm font-bold text-white");
s=s.replaceAll(darkButton,"bg-[#E51B23] text-sm font-extrabold text-white");
if(s.includes("bg-amber-300")||s.includes("bg-[#211A08]"))throw Error("[FAIL] legacy gold correction theme remains");
writeFileSync(p,s,"utf8");
console.log("[OK] Driver corrections UI: APOIS red/white/black; RPCs and form events untouched.");
