// APOIS_RIDE_TIMELINE_CONTRAST_V1 — white empty-looking outline during "Buscando motoristas".
// The ride stops component previously depended on dark theme zinc-* foreground;
// the approved white/red visual theme can make these texts visually invisible.
// Fix foreground/background locally; no ride, map or payment state changes.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/components/rides/active/RideStopsTimeline.tsx");
let src=readFileSync(file,"utf8");
function once(a,b,label){const n=src.split(a).length-1;if(n!==1)throw Error("[FAIL] Ride timeline contrast "+label+": "+n);src=src.replace(a,b);}
if(src.includes("APOIS_RIDE_TIMELINE_CONTRAST_V1"))throw Error("[FAIL] patch already installed");
once('<div className="bg-zinc-900/30 rounded-2xl p-4 border border-white/5 space-y-4">',
  '<div data-apois-ride-timeline-contrast-v1 className="rounded-2xl border border-[#E8CED2] bg-white p-4 text-[#111827] shadow-sm space-y-4">',"visible timeline surface");
if(src.split("bg-zinc-800 my-1").length-1!==2)throw Error("[FAIL] Ride timeline route connector count changed");
src=src.replaceAll("bg-zinc-800 my-1","bg-[#D1D5DB] my-1");
once('border border-zinc-600 bg-zinc-900','border border-[#9CA3AF] bg-white',"intermediate stop marker");
if(src.split("text-zinc-600 mb-0.5").length-1!==2)throw Error("[FAIL] Ride timeline labels changed");
src=src.replaceAll("text-zinc-600 mb-0.5","text-[#586272] mb-0.5");
if(src.split("text-zinc-300 truncate").length-1!==3)throw Error("[FAIL] Ride timeline titles changed");
src=src.replaceAll("text-zinc-300 truncate","text-[#111827] truncate");
for(const t of ['data-apois-ride-timeline-contrast-v1','Embarque','Destino Final','ride.origin_name','ride.destination_name','stops.map'])if(!src.includes(t))throw Error("[FAIL] Missing stop/timeline marker "+t);
writeFileSync(file,src,"utf8");
console.log("[OK] Corridas: route overview shows visible pickup, stops and destination on white surface.");
