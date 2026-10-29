import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(root,"src/routes/motorista.app.tsx");
const cssFile=resolve(root,"src/styles.css");
let source=readFileSync(file,"utf8");
function once(text,from,to,label){
 const n=text.split(from).length-1;
 if(n!==1) throw Error("[FAIL] Driver V6 "+label+" count="+n);
 return text.replace(from,to);
}
source=once(source,
 'const NAVIGATION_CENTER_AHEAD_METERS = 105;',
 'const NAVIGATION_CENTER_AHEAD_METERS = 175;',
 "center map ahead toward next maneuver");
source=once(source,
 'return normalizeHeading(position.heading) ?? routeHeadingFrom(position, route, destination);',
 'return routeHeadingFrom(position, route, destination) ?? normalizeHeading(position.heading);',
 "route direction before unreliable stationary GPS heading");
// Camera APIs differ across protected driver versions. Preserve the mode
// logic and force north-up by overriding the final heading value only.
source=source.replace(/(heading:\s*)[^,\n]+(,\n\s*tilt:\s*0,)/,
  (_all, prefix, suffix) => prefix+"0"+suffix);
source=once(source,
 '      navMap.setHeading?.(heading);\n      navMap.setTilt?.(0);',
 '      navMap.setHeading?.(0);\n      navMap.setTilt?.(0);',
 "do not rotate roadmap");

const overlayAt=source.indexOf("function ActiveTripNavOverlay(");
if(overlayAt<0)throw Error("[FAIL] Driver V6 active trip overlay not found");
let overlay=source.slice(overlayAt);
overlay=once(overlay,
 '  onComplete,\n}: {',
 '  onComplete,\n  onShowRoute,\n  onRecenter,\n}: {',
 "overview callbacks");
overlay=once(overlay,
 '  onComplete: () => Promise<void> | void;',
 '  onComplete: () => Promise<void> | void;\n  onShowRoute: () => void;\n  onRecenter: () => void;',
 "overview types");
overlay=overlay.replace(/className="pointer-events-auto rounded-\\[22px\\][^"]*"/,
 'data-apois-trip-top-v6 className="pointer-events-auto rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-3 text-[#111827] shadow-lg"');
if(!overlay.includes("data-apois-trip-top-v6"))throw Error("[FAIL] statistics header not found");
overlay=once(overlay,
 '          </div>\n          <div className="flex items-center justify-between gap-2">\n            <TopStat',
 '            <div className="ml-auto flex items-center gap-1">\n              <button type="button" onClick={onShowRoute} aria-label="Ver rota inteira" className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1.5 text-xs font-bold text-[#344054]">Ver rota</button>\n              <button type="button" onClick={onRecenter} aria-label="Acompanhar motorista" className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1.5 text-xs font-bold text-[#344054]">Seguir</button>\n            </div>\n          </div>\n          <div className="flex items-center justify-between gap-2">\n            <TopStat',
 "route buttons");
overlay=once(overlay,
 'className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0B0F17]/95 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200"',
 'data-apois-trip-bottom-v6 className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E5E7EB] bg-white text-[#111827] shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"',
 "light compact bottom");
overlay=once(overlay,
 'className="mx-auto flex w-full max-w-md flex-col gap-2.5 px-4 pt-3 pb-3"',
 'className="mx-auto flex w-full max-w-md flex-col gap-2 px-4 pt-2.5 pb-2.5"',
 "shrink bottom footprint");
overlay=once(overlay,
 'className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl bg-white/[0.05] px-2.5 py-2 text-left ring-1 ring-white/10 transition active:scale-[0.99] hover:bg-white/[0.08]"',
 'className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-2 text-left transition active:scale-[0.99] hover:bg-[#F2F4F7]"',
 "passenger row contrast");
overlay=once(overlay,
 'className="truncate text-[13px] font-bold leading-tight text-white"',
 'className="truncate text-[14px] font-bold leading-tight text-[#111827]"',
 "passenger name contrast");
overlay=once(overlay,
 'className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-white/60"',
 'className="mt-0.5 flex items-center gap-1 truncate text-[11.5px] text-[#667085]"',
 "destination name contrast");
overlay=overlay.replace(/className="flex h-12 w-full items-center justify-center gap-2 rounded-\\[14px\\][^"]*"/,
 'className="flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#E51B23] text-[15px] font-bold uppercase tracking-[0.06em] text-white shadow-sm transition active:scale-[0.98] hover:bg-[#C9141B] disabled:cursor-not-allowed disabled:opacity-60"');
if(!overlay.includes('bg-[#E51B23] text-[15px] font-bold'))throw Error("[FAIL] finish CTA not found");
source=source.slice(0,overlayAt)+overlay;
source=once(source,
 '          onOpenProfile={() => active.passenger_id && setProfilePassengerId(active.passenger_id)}\n          onComplete={async () => {',
 '          onOpenProfile={() => active.passenger_id && setProfilePassengerId(active.passenger_id)}\n          onShowRoute={() => {\n            const m=mapRef.current;\n            if(!m||!position)return;\n            const b=new google.maps.LatLngBounds();\n            b.extend(position);\n            b.extend({lat:active.destination_lat,lng:active.destination_lng});\n            polyline.forEach((p)=>b.extend(p));\n            autoFollowRef.current=false;\n            m.fitBounds(b,{top:155,right:32,bottom:220,left:32});\n          }}\n          onRecenter={recenter}\n          onComplete={async () => {',
 "wire route overview with return to follow");

const css=readFileSync(cssFile,"utf8");
if(css.includes("APOIS_DRIVER_TRIP_V6"))throw Error("[FAIL] duplicate CSS");
writeFileSync(cssFile,css+"\n"+[
 "/* APOIS_DRIVER_TRIP_V6: avoid dark theme inheritance over passenger name. */",
 "[data-apois-trip-top-v6], [data-apois-trip-bottom-v6] { background:#fff!important; color:#111827!important; }",
 "[data-apois-trip-top-v6] [class*='text-foreground'], [data-apois-trip-bottom-v6] [class*='text-foreground'] { color:#111827!important; }",
 "[data-apois-trip-top-v6] [class*='text-muted-foreground'], [data-apois-trip-bottom-v6] [class*='text-muted-foreground'] { color:#667085!important; }",
 "[data-apois-trip-bottom-v6] button[aria-label='Ver perfil do passageiro'] { background:#F9FAFB!important; color:#111827!important; }",
 "[data-apois-trip-bottom-v6] button[aria-label='Ver perfil do passageiro'] [class*='text-white'] { color:#111827!important; }",
 ].join("\n"),"utf8");
writeFileSync(file,source,"utf8");
const voiceFile=resolve(root,"src/components/DriverVoiceToggle.tsx");
let voice=readFileSync(voiceFile,"utf8");
voice=once(voice,
 'className="fixed z-[46] flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#0D0F11]/92 text-[#F6BE1C] shadow-[0_14px_32px_-18px_rgba(0,0,0,0.9)] backdrop-blur-md disabled:cursor-not-allowed disabled:opacity-60 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6BE1C] focus-visible:ring-offset-2 focus-visible:ring-offset-black"',
 'className="fixed z-[46] flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-[#E5E7EB] bg-white px-3 text-[#C9141B] shadow-lg disabled:cursor-not-allowed disabled:opacity-60 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E51B23]"',
 "voice toggle high contrast");
voice=once(voice,
 'top: "calc(env(safe-area-inset-top) + 78px)",',
 'top: "calc(env(safe-area-inset-top) + 158px)",',
 "voice toggle away from top overlay");
voice=once(voice,
 '      {enabled ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5 text-zinc-400" aria-hidden="true" />}',
 '      {enabled ? <Volume2 className="h-5 w-5" aria-hidden="true" /> : <VolumeX className="h-5 w-5 text-[#667085]" aria-hidden="true" />}\n      <span className="text-xs font-bold">{enabled ? "Voz ligada" : "Voz desligada"}</span>',
 "voice toggle explicit label");
writeFileSync(voiceFile,voice,"utf8");
console.log("[OK] Motorista V6: bright trip panels, compact footer, route overview/follow, persistent voice toggle.");
