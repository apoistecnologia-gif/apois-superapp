import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname,resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const path=resolve(root,"src/routes/motorista.app.tsx");
const widget=resolve(root,"src/components/ApoisRideComfortCard.tsx");
mkdirSync(dirname(widget),{recursive:true});
writeFileSync(widget,"import React from \"react\";\ntype Choice = \"yes\"|\"no\"|\"no_preference\";\ntype Comfort = {conversation:\"quiet\"|\"talk\"|\"no_preference\";music:Choice;air_conditioning:Choice};\nconst labels = {\n  conversation: {quiet:\"Prefere silêncio\",talk:\"Pode conversar\",no_preference:\"Conversa: indiferente\"},\n  music: {yes:\"Quer ouvir música\",no:\"Prefere sem música\",no_preference:\"Música: indiferente\"},\n  air_conditioning: {yes:\"Ar-condicionado ligado\",no:\"Ar-condicionado desligado\",no_preference:\"Ar-condicionado: indiferente\"},\n};\nexport function ApoisRideComfortCard({details}:{details:unknown}) {\n  if(!details || typeof details!==\"object\" || Array.isArray(details))return null;\n  const raw=(details as Record<string,unknown>).ride_comfort_preferences;\n  if(!raw || typeof raw!==\"object\" || Array.isArray(raw))return null;\n  const r=raw as Record<string,unknown>;\n  const conversation=[\"quiet\",\"talk\",\"no_preference\"].includes(String(r.conversation))?r.conversation as Comfort[\"conversation\"]:\"no_preference\";\n  const music=[\"yes\",\"no\",\"no_preference\"].includes(String(r.music))?r.music as Choice:\"no_preference\";\n  const air_conditioning=[\"yes\",\"no\",\"no_preference\"].includes(String(r.air_conditioning))?r.air_conditioning as Choice:\"no_preference\";\n  return <section data-apois-ride-comfort-driver-v1 aria-label=\"Preferências do passageiro\"\n    className=\"mt-2.5 rounded-2xl border border-[#E00029]/35 bg-white p-3 text-[#111827] shadow-sm\">\n    <p className=\"text-[11px] font-extrabold uppercase tracking-wider text-[#B91C1C]\">Preferências do passageiro</p>\n    <ul className=\"mt-2 space-y-1 text-xs font-semibold\">\n      <li>Conversa: {labels.conversation[conversation]}</li>\n      <li>Música: {labels.music[music]}</li>\n      <li>Ar-condicionado: {labels.air_conditioning[air_conditioning]}</li>\n    </ul>\n    <p className=\"mt-2 text-[10px] text-zinc-600\">Respeite as preferências sempre que possível, com segurança.</p>\n  </section>;\n}","utf8");
let src=readFileSync(path,"utf8");
if(src.includes("APOIS_RIDE_COMFORT_DRIVER_V1"))process.exit(0);
function rep(a,b,label){if(src.split(a).length!==2)throw Error("[FAIL] Motorista ride comfort "+label);src=src.replace(a,b);}
rep('import { MovviMap } from "@/components/MovviMap";',
    'import { MovviMap } from "@/components/MovviMap";\nimport { ApoisRideComfortCard } from "@/components/ApoisRideComfortCard";\n// APOIS_RIDE_COMFORT_DRIVER_V1',
    'import');
rep('          {/* Endereços */}',
    '          <ApoisRideComfortCard details={ride.service_details} />\n\n          {/* Endereços */}',
    'offer before accept');
const passengerCard='          {/* Passenger card */}';
const count=src.split(passengerCard).length-1;
if(count<2 || count>3)throw Error("[FAIL] Driver active panels unexpectedly contain "+count+" passenger card anchors");
src=src.split(passengerCard).join('          <ApoisRideComfortCard details={ride.service_details} />\n'+passengerCard);
rep('          <ActiveRidePanel\n',
    '          <ApoisRideComfortCard details={active.service_details} />\n          <ActiveRidePanel\n',
    'other active stages');
writeFileSync(path,src,"utf8");
console.log("[OK] Motorista: ride comfort before acceptance, pickup, active trip, other stages; source offers unchanged.");
