// APOIS_CLIENTE_ACTIVE_RIDE_SUMMARY_CONTRAST_V1
// Field evidence: blank white rounded block immediately above Cancelar Corrida.
// The persisted ride has origin_name/destination_name, but the inherited dark
// timeline text becomes unreadable against the new white/red theme.
// Fix only contrast/scroll clearance, preserving stops and ride actions.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const timeline=resolve(root,"src/components/rides/active/RideStopsTimeline.tsx");
const route=resolve(root,"src/routes/_authenticated.corrida.$rideId.tsx");
function once(s,a,b,label){
 const n=s.split(a).length-1;
 if(n!==1)throw Error("[FAIL] Ride summary contrast "+label+": "+n);
 return s.replace(a,b);
}
let card=readFileSync(timeline,"utf8");
if(card.includes("APOIS_CLIENTE_ACTIVE_RIDE_SUMMARY_CONTRAST_V1"))throw Error("[FAIL] Summary contrast applied twice");
card=once(card,
  'className="bg-zinc-900/30 rounded-2xl p-4 border border-white/5 space-y-4"',
  'data-apois-ride-summary-contrast-v1 className="rounded-2xl border border-[#E2E4E8] bg-white p-4 text-[#111827] shadow-sm space-y-4"',
  "visible white card");
card=once(card,
  '  const stops = ride.intermediates || [];',
  '  const stops = ride.intermediates || []; // APOIS_CLIENTE_ACTIVE_RIDE_SUMMARY_CONTRAST_V1',
  "idempotency mark");
card=card.replaceAll("text-zinc-600","text-[#596372]")
  .replaceAll("text-zinc-300","text-[#111827]")
  .replaceAll("bg-zinc-800","bg-[#CBD5E1]")
  .replaceAll('border-zinc-600 bg-zinc-900','border-[#94A3B8] bg-white');
card=once(card,'{ride.origin_name}', '{ride.origin_name || "Ponto de partida"}', "origin fallback");
card=once(card,'{ride.destination_name}', '{ride.destination_name || "Destino da corrida"}', "destination fallback");
writeFileSync(timeline,card,"utf8");
let ui=readFileSync(route,"utf8");
if(!ui.includes("APOIS_CANCEL_VISIBLE_V1"))throw Error("[FAIL] Fixed cancellation action must remain present");
const panel=/className="(max-h-\[60vh\][^"]*?)"/g;
let m=[...ui.matchAll(panel)];if(m.length!==1)throw Error("[FAIL] Ride panel class changed: "+m.length);
const before=m[0][0];
if(!before.includes("overflow-y-auto")||!before.includes("pb-8"))throw Error("[FAIL] Ride panel original scroll/padding missing");
const after=before.replace("pb-8","pb-[calc(164px+env(safe-area-inset-bottom))]");
ui=once(ui,before,after,"ensure timeline/estimate scroll above fixed cancel");
for(const token of [
  "<RideStopsTimeline ride={ride} />",
  "CANCELAR CORRIDA",
  "APOIS_CANCEL_VISIBLE_V1",
  "ride.estimated_price",
])if(!ui.includes(token))throw Error("[FAIL] Ride summary contract lost: "+token);
writeFileSync(route,ui,"utf8");
console.log("[OK] Cliente: visible trip pickup/destination card with dark text and enough scroll clearance for fixed cancellation.");
