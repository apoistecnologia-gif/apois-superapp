import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/corridas");
const read=(path)=>readFileSync(resolve(root,path),"utf8");
const write=(path,s)=>writeFileSync(resolve(root,path),s,"utf8");
function patch(path,fn){let old=read(path);if(old.includes("APOIS_RIDE_COMFORT_PREFS_V1")){console.log("[OK] ride comfort already applied "+path);return;}let now=fn(old);if(now===old)throw Error("[FAIL] ride comfort unchanged "+path);write(path,now);}
function rep(s,anchor,replacement,label){if(s.split(anchor).length!==2)throw Error("[FAIL] ride comfort anchor "+label);return s.replace(anchor,replacement);}
patch("src/types/rides/ride-request.ts",s=>{
  return '// APOIS_RIDE_COMFORT_PREFS_V1: per-ride preferences, never pricing modifiers.\nexport type RideComfortChoice = "yes" | "no" | "no_preference";\nexport interface RideComfortPreferences {\n  conversation: "quiet" | "talk" | "no_preference";\n  music: RideComfortChoice;\n  air_conditioning: RideComfortChoice;\n}\n\n'+s;
});
patch("src/hooks/rides/use-ride-request.tsx",s=>{
 s=rep(s,'import type { RideRequestPayload, RideRequestResponse } from "@/types/rides/ride-request";',
  'import type { RideRequestPayload, RideRequestResponse, RideComfortPreferences } from "@/types/rides/ride-request";',"types");
 s=rep(s,'  confirmRide: () => Promise<RideRequestResponse | null>;',
  '  confirmRide: (comfort?: RideComfortPreferences) => Promise<RideRequestResponse | null>;',"context");
 s=rep(s,'  const confirmRide = useCallback(async (): Promise<RideRequestResponse | null> => {',
  '  // APOIS_RIDE_COMFORT_PREFS_V1\n  const confirmRide = useCallback(async (comfort?: RideComfortPreferences): Promise<RideRequestResponse | null> => {',"callback");
 s=rep(s,'        service_details: selectedCategory.details ?? {},',
  '        service_details: { ...(selectedCategory.details ?? {}), ...(selectedCategory.code === "carros" && comfort ? {ride_comfort_preferences: comfort} : {}) },',"payload preserves category details");
 return s;
});
patch("src/routes/_authenticated.revisar-solicitacao.tsx",s=>{
 s=rep(s,'import React, { useCallback, useRef } from "react";',
   'import React, { useCallback, useRef, useState } from "react";\nimport type { RideComfortPreferences } from "@/types/rides/ride-request";',"import");
 s=rep(s,'  const confirmationInFlightRef = useRef(false);',
   '  // APOIS_RIDE_COMFORT_PREFS_V1: selections reset on each review mount.\n  const [comfort,setComfort]=useState<RideComfortPreferences>({conversation:"no_preference",music:"no_preference",air_conditioning:"no_preference"});\n  const confirmationInFlightRef = useRef(false);',"state");
 s=rep(s,'      const response = await confirmRide();','      const response = await confirmRide(comfort);',"submit");
 s=rep(s,'  }, [confirmRide, isSubmitting, navigate, recoverActiveRide, walletState]);',
   '  }, [confirmRide, comfort, isSubmitting, navigate, recoverActiveRide, walletState]);',"deps");
 const box=[
 '        {selectedCategory?.code === "carros" && (',
 '          <section data-apois-ride-comfort-prefs-v1 className="rounded-2xl border border-[#E00029]/30 bg-zinc-900/80 p-4 space-y-3">',
 '            <div>',
 '              <h2 className="text-base font-extrabold text-white">Como prefere sua viagem?</h2>',
 '              <p className="mt-1 text-xs text-zinc-300">Escolhas opcionais, informadas ao motorista antes de aceitar. Não alteram a tarifa.</p>',
 '            </div>',
 '            {([',
 '              {key:"conversation" as const,label:"Conversa",options:[["no_preference","Sem preferência"],["quiet","Prefiro silêncio"],["talk","Pode conversar"]]},',
 '              {key:"music" as const,label:"Música",options:[["no_preference","Sem preferência"],["yes","Quero ouvir música"],["no","Prefiro sem música"]]},',
 '              {key:"air_conditioning" as const,label:"Ar-condicionado",options:[["no_preference","Sem preferência"],["yes","Prefiro ligado"],["no","Prefiro desligado"]]},',
 '            ]).map(({key,label,options})=>(',
 '              <label key={key} className="block space-y-1">',
 '                <span className="text-sm font-semibold text-white">{label}</span>',
 '                <select aria-label={"Preferência de "+label} value={comfort[key]}',
 '                  onChange={(event)=>setComfort((previous)=>({...previous,[key]:event.target.value as typeof previous[typeof key]}))}',
 '                  className="min-h-12 w-full rounded-xl border border-zinc-600 bg-zinc-800 px-3 text-sm text-white">',
 '                  {options.map(([value,text])=><option key={value} value={value}>{text}</option>)}',
 '                </select>',
 '              </label>',
 '            ))}',
 '            <p className="text-xs text-zinc-400">O motorista verá suas escolhas. Preferências de conforto dependem das condições do veículo e da segurança da viagem.</p>',
 '          </section>',
 '        )}',
 ].join("\n");
 s=rep(s,'        <div className="bg-zinc-900/50 rounded-2xl p-5 border border-white/5 space-y-4">',box+'\n\n        <div className="bg-zinc-900/50 rounded-2xl p-5 border border-white/5 space-y-4">',"comfort UI before total");
 return s;
});
console.log("[OK] Cliente Corridas: optional conversation, music and A/C per ride in service_details; fare unchanged.");
