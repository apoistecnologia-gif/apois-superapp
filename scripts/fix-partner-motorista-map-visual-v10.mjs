// APOIS_DRIVER_FIELD_VISUAL_V10: fixes demonstrated by 06/11/2026 physical QA.
// Generated Motorista only; no database, payment, account or dispatch mutation.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const route=resolve(root,"src/routes/motorista.app.tsx");
let src=readFileSync(route,"utf8");
function once(before,after,label){const n=src.split(before).length-1;if(n!==1)throw Error("[FAIL] Driver field V10 "+label+" "+n);src=src.replace(before,after);}
if(src.includes("APOIS_DRIVER_FIELD_VISUAL_V10"))throw Error("[FAIL] Field V10 patched twice");
// Preserve ability to expand, but give the route/map much more room while waiting for PIN.
once('snaps={[58, 78, 92]} initial={70}',
     'snaps={[42, 62, 84]} initial={42}',"smaller initial pickup sheet");
// Avoid automatic IME launch clipping the PIN title on compact Android WebViews.
// Driver taps a clearly visible field to open keyboard, with form scroll still active.
const pinInput=src.indexOf('id="apois-motorista-pin-v4"');
if(pinInput<0)throw Error("[FAIL] PIN V4 numeric field not found");
const pinBefore=src.slice(0,pinInput),pinAfter=src.slice(pinInput);
if(!pinAfter.slice(0,500).includes("autoFocus"))throw Error("[FAIL] PIN autofocus changed");
src=pinBefore+pinAfter.replace('                    autoFocus\n','                    autoFocus={false}\n');
// Map polyline: reduce the road paint that obscures lane-level street labels.
const mapStart=src.indexOf('          {polyline.length > 0 && (');
const mapEnd=src.indexOf('         </MovviMap>',mapStart);
if(mapStart<0||mapEnd<mapStart)throw Error("[FAIL] Map polyline bounds not found");
let paint=src.slice(mapStart,mapEnd);
const weights=paint.match(/strokeWeight:\s*\d+/g)||[];
if(weights.length<3)throw Error("[FAIL] Original layered road line markers missing");
paint=paint.replace(/strokeWeight:\s*20\b/g,"strokeWeight: 11")
           .replace(/strokeWeight:\s*14\b/g,"strokeWeight: 8")
           .replace(/strokeWeight:\s*9\b/g,"strokeWeight: 6");
src=src.slice(0,mapStart)+paint+src.slice(mapEnd);
// Rating success is a new screen, not a translucent dialog over a moving map.
const ratingStart=src.indexOf("function RatingScreen("),ratingEnd=src.indexOf("function SummaryRow(",ratingStart);
if(ratingStart<0||ratingEnd<ratingStart)throw Error("[FAIL] Rating screen boundary");
let rating=src.slice(ratingStart,ratingEnd);
if(!rating.includes("data-apois-driver-rating-readable-v7"))throw Error("[FAIL] Rating light-theme hardener missing");
rating=rating.replace(/(data-apois-driver-rating-readable-v7 className=")[^"]*"/,
  '$1fixed inset-0 z-[80] flex items-end justify-center bg-[#F8FAFC] animate-in fade-in duration-300"');
rating=rating.replace(/style=\{\{ backdropFilter: "[^"]+" \}\}/,
  'style={{ backgroundColor: "#F8FAFC", backdropFilter: "none" }}');
if(!rating.includes('bg-[#F8FAFC]')||!rating.includes('text-[#111827]'))throw Error("[FAIL] Rating foreground/solid surface");
rating=rating.replace('label="Distância" value={distanceLabel}','label="Distância prevista" value={distanceLabel}')
             .replace('label="Duração" value={durationLabel}','label="Tempo previsto" value={durationLabel}');
if(!rating.includes("Distância prevista")||!rating.includes("Tempo previsto"))throw Error("[FAIL] Estimated trip summary labels");
src=src.slice(0,ratingStart)+rating+src.slice(ratingEnd);
// Avoid accidental completion far from destination, while retaining a clear
// exceptional-finish path for actual drop-offs away from the original pin.
// The server remains authority; this is an additional physical QA safeguard.
const compStart=src.indexOf("function ActiveTripNavOverlay(");
if(compStart<0)throw Error("[FAIL] Navigation overlay not found");
let overlay=src.slice(compStart);
if(!overlay.includes('data-apois-trip-top-v6')||!overlay.includes("  const handleComplete = async () => {"))throw Error("[FAIL] Navigation V6 contract changed");
const text='  const handleComplete = async () => {';
if(overlay.split(text).length!==2)throw Error("[FAIL] Complete handler count");
overlay=overlay.replace(text,[
'  // APOIS_DRIVER_FIELD_VISUAL_V10: client-only confirmation for early finish.',
'  const [earlyFinishConfirmOpen,setEarlyFinishConfirmOpen] = useState(false);',
'  const handleComplete = async () => {',
'    if (busy) return;',
'    if (distanceToDestinationKm !== null && Number.isFinite(distanceToDestinationKm) &&',
'        distanceToDestinationKm > 0.3 && !earlyFinishConfirmOpen) {',
'      setEarlyFinishConfirmOpen(true);',
'      return;',
'    }',
'    setEarlyFinishConfirmOpen(false);',
].join("\n"));
const prop='  onComplete,\n  onShowRoute,\n  onRecenter,\n}: {';
if(overlay.split(prop).length!==2)throw Error("[FAIL] navigation props contract");
overlay=overlay.replace(prop,'  onComplete,\n  onShowRoute,\n  onRecenter,\n  distanceToDestinationKm,\n}: {');
const propType='  onComplete: () => Promise<void> | void;\n  onShowRoute: () => void;';
if(overlay.split(propType).length!==2)throw Error("[FAIL] navigation prop type");
overlay=overlay.replace(propType,'  onComplete: () => Promise<void> | void;\n  distanceToDestinationKm: number | null;\n  onShowRoute: () => void;');
const closing='       </div>\n     </>\n   );'; // tolerate component formatting through a safer terminal marker
const last=overlay.lastIndexOf('      </div>\n    </>\n  );');
if(last<0)throw Error("[FAIL] ActiveTripNavOverlay closing fragment");
const dialog=[
'      {earlyFinishConfirmOpen && (',
'        <div role="dialog" aria-modal="true" aria-label="Confirmar finalização antecipada" className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-3 pb-[max(24px,env(safe-area-inset-bottom))]">',
'          <div className="w-full max-w-md rounded-[24px] bg-white p-5 text-[#111827] shadow-2xl">',
'            <h3 className="text-lg font-extrabold">Você ainda está longe do destino</h3>',
'            <p className="mt-2 text-sm leading-6 text-[#475467]">O GPS indica que faltam cerca de {distanceToDestinationKm?.toFixed(1)} km. Finalize somente se o passageiro realmente desembarcou ou solicitou encerramento antecipado.</p>',
'            <button type="button" onClick={() => setEarlyFinishConfirmOpen(false)} className="mt-4 min-h-12 w-full rounded-xl bg-[#F2F4F7] font-bold text-[#111827]">Continuar corrida</button>',
'            <button type="button" onClick={() => void handleComplete()} disabled={busy} className="mt-2 min-h-12 w-full rounded-xl bg-[#E51B23] font-extrabold text-white disabled:opacity-60">Confirmar finalização antecipada</button>',
'          </div>',
'        </div>',
'      )}',
].join("\n");
const afterFooter = last + '      </div>\n'.length;
overlay=overlay.slice(0,afterFooter)+dialog+"\n"+overlay.slice(afterFooter);
src=src.slice(0,compStart)+overlay;
const call='          onRecenter={recenter}\n          onComplete={async () => {';
if(src.split(call).length!==2)throw Error("[FAIL] Active navigation callback");
src=src.replace(call,
'          onRecenter={recenter}\n          distanceToDestinationKm={position ? haversineKm(position, {lat:active.destination_lat,lng:active.destination_lng}) : null}\n          onComplete={async () => {');
if(!src.includes("APOIS_DRIVER_FIELD_VISUAL_V10")||!src.includes("distanceToDestinationKm")||!src.includes("Confirmar finalização antecipada"))throw Error("[FAIL] Field V10 completeness");
writeFileSync(route,src,"utf8");
// The embedded APOIS logo should never present a browser broken-image icon.
const logoPath=resolve(root,"src/components/MovviLogo.tsx");
let logo=readFileSync(logoPath,"utf8");
if(!logo.includes("APOIS_LOGO_DATA_URL")||!logo.includes("<img"))throw Error("[FAIL] Official logo component missing");
logo=logo.replace('import { APOIS_LOGO_DATA_URL }', 'import { useState } from "react";\nimport { APOIS_LOGO_DATA_URL }');
logo=logo.replace('  const logoSize = safeLogoSize(size);',
  '  const [logoFailed,setLogoFailed] = useState(false);\n  const logoSize = safeLogoSize(size);');
logo=logo.replace('      <img\n        src={APOIS_LOGO_DATA_URL}',
  '      {logoFailed ? <span className="flex h-full w-full items-center justify-center text-[11px] font-black text-white">APOIS</span> : <img\n        onError={() => setLogoFailed(true)}\n        src={APOIS_LOGO_DATA_URL}');
logo=logo.replace('        decoding="async"\n      />','        decoding="async"\n      />}');
if(!logo.includes('onError={() => setLogoFailed(true)}'))throw Error("[FAIL] Logo broken-image fallback not installed");
writeFileSync(logoPath,logo,"utf8");
console.log("[OK] Driver field V10: smaller pickup sheet, PIN IME fix, thinner map route, opaque rating, honest estimated data, guarded early finish and logo fallback.");
