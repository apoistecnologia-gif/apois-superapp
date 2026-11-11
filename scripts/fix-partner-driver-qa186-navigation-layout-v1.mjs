// APOIS_DRIVER_QA186_NAV_LAYOUT_V1: QA185 Android video; disposable Motorista only.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(root,"src/routes/motorista.app.tsx");
const comfortFile=resolve(root,"src/components/ApoisRideComfortCard.tsx");
const cssFile=resolve(root,"src/styles.css");
let s=readFileSync(file,"utf8"),comfort=readFileSync(comfortFile,"utf8"),css=readFileSync(cssFile,"utf8");
function once(src,old,next,label){const n=src.split(old).length-1;if(n!==1)throw Error("[FAIL] QA186 "+label+" count="+n);return src.replace(old,next);}
if(s.includes("APOIS_DRIVER_QA186_NAV_LAYOUT_V1"))throw Error("[FAIL] QA186 applied twice");
for(const x of ["APOIS_DRIVER_RIDE_MAP_STABILITY_V2","APOIS_ASSIGNED_PASSENGER_V6","data-apois-pin-v4","onStart(pinCode)"])
 if(!s.includes(x))throw Error("[FAIL] prerequisite "+x);
// Initial snap was rounded to 78dvh, hiding almost all of the map.
s=once(s,'<MovviSheet ref={sheetRef} snaps={[58, 78, 92]} initial={70}>',
 '<MovviSheet ref={sheetRef} snaps={[39, 62, 88]} initial={39}>',"waiting sheet");
s=once(s,'? "calc(78dvh + 12px)"','? "calc(42dvh + 12px)"',"recenter");
// Preserve comfort info with a tap-accessible disclosure while waiting only.
s=once(s,'          <ApoisRideComfortCard details={active.service_details} />\n          <ActiveRidePanel',
 '          <details data-apois-waiting-comfort-v1 className="group rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] text-[#344054]">\n'+
 '            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[12px] font-bold [&::-webkit-details-marker]:hidden">Preferências do passageiro <span aria-hidden="true" className="text-[#667085] group-open:rotate-90">›</span></summary>\n'+
 '            <ApoisRideComfortCard details={active.service_details} />\n'+
 '          </details>\n          <ActiveRidePanel',"comfort disclosure");
const start=s.indexOf("function ActiveRidePanel("),end=s.indexOf("\nfunction ActionButton(",start);
if(start<0||end<=start)throw Error("[FAIL] ActiveRidePanel boundaries");
let panel=s.slice(start,end);
const a=panel.indexOf("      {/* CTA — sticky no rodapé da sheet"),b=panel.indexOf("      {cancelRideDialog}",a);
if(a<0||b<=a)throw Error("[FAIL] waiting CTA boundaries");
const actions=[
'      {/* APOIS_DRIVER_QA186_NAV_LAYOUT_V1: no callback/ride rule changes. */}',
'      {isArrived && createPortal(',
'        <div data-apois-waiting-actions-v1 className="fixed inset-x-0 bottom-0 z-[70] border-t border-[#E5E7EB] bg-white/95 text-[#111827] shadow-[0_-9px_28px_-18px_rgba(17,24,39,.35)] backdrop-blur-sm" style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>',
'          <div className="mx-auto flex w-full max-w-md flex-col gap-1.5 px-4 py-2">',
'            <ActionButton label="Iniciar corrida" onClick={() => { setPinError(null); setPinCode(""); setPinOpen(true); }} icon={ChevronRight} emphasize />',
'            <button type="button" aria-label="Passageiro não apareceu" onClick={() => { setCancelReason("Passageiro não apareceu"); setCancelOpen(true); }}',
'              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#FBCAD0] bg-[#FFF1F2] px-3 text-[12px] font-bold text-[#AF1830] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E51B23]">',
'              <AlertTriangle className="h-4 w-4" /> Passageiro não apareceu',
'            </button>',
'          </div>',
'        </div>, document.body,',
'      )}',
'      {cancelRideDialog && createPortal(cancelRideDialog, document.body)}',
''
].join("\n");
panel=panel.slice(0,a)+actions+panel.slice(b+"      {cancelRideDialog}\n".length);
panel=once(panel,
 '<div data-apois-ride-phase-v4 className="flex flex-col gap-2.5 rounded-[22px] bg-white px-1 pt-1 text-[#111827]">',
 '<div data-apois-ride-phase-v4 className="flex flex-col gap-2.5 rounded-[22px] bg-white px-1 pt-1 pb-[136px] text-[#111827]">',"scroll clearance");
s=s.slice(0,start)+panel+s.slice(end);
// No keyboard until driver touches a square; WebView can settle initial layout.
s=once(s,'                    autoFocus\n                    maxLength={4}\n                    disabled={pinBusy}',
 '                    maxLength={4}\n                    disabled={pinBusy}',"PIN focus");
s=once(s,'className="fixed inset-0 z-[1000] flex items-end justify-center bg-[#101828]/60 sm:items-center"',
 'className="fixed inset-0 z-[1000] flex items-end justify-center overflow-y-auto overscroll-contain bg-[#101828]/60 pt-[max(8px,env(safe-area-inset-top))] sm:items-center',"PIN scroll");
s=once(s,'className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"',
 'className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0 scroll-mt-24',"PIN tap field");
// Respect RLS: no fabricated passenger identity.
const fallback='{passenger?.name ?? "Passageiro"}';
const hits=s.split(fallback).length-1;
if(hits<2||hits>15)throw Error("[FAIL] name count="+hits);
s=s.replaceAll(fallback,'{passenger?.name ?? "Nome indisponível"}');
for(const old of ['no_preference:"Conversa: indiferente"','no_preference:"Música: indiferente"','no_preference:"Ar-condicionado: indiferente"'])
 comfort=once(comfort,old,'no_preference:"indiferente"',"duplicate comfort label");
css+=[
'',
'/* APOIS_DRIVER_QA186_NAV_LAYOUT_V1: scoped only to driver workspace. */',
'[data-apois-waiting-comfort-v1] [data-apois-ride-comfort-driver-v1] { margin-top:0; border:0; border-radius:0; box-shadow:none; background:#F8FAFC; }',
'[data-apois-waiting-comfort-v1] [data-apois-ride-comfort-driver-v1] > p:first-child { display:none; }',
'[data-apois-waiting-comfort-v1]:focus-within > summary { outline:2px solid #C9141B; outline-offset:-2px; }',
'[data-apois-pin-v4] label:focus-within [aria-hidden="true"] > span { border-color:#C9141B; background:#FFF1F2; }',
'[data-apois-pin-v4] { overscroll-behavior:contain; }',
''
].join("\n");
for(const x of ["onStart(pinCode)","onClick={onAccept}","onClick={handleComplete}","APOIS_DRIVER_RIDE_MAP_STABILITY_V2","data-apois-waiting-actions-v1","createPortal(cancelRideDialog, document.body)"])
 if(!s.includes(x))throw Error("[FAIL] preserved callback missing "+x);
// Temporary QA187 diagnostics: print only generated JSX around TypeScript parse errors.
const generatedLines=s.split("\n");
for(const [from,to] of [[3098,3107],[3155,3165]]) {
  console.log("[QA187] generated JSX lines "+from+"-"+to);
  for(let line=from;line<=to;line++) console.log("[QA187] "+line+": "+(generatedLines[line-1]||""));
}
writeFileSync(file,s,"utf8");writeFileSync(comfortFile,comfort,"utf8");writeFileSync(cssFile,css,"utf8");
console.log("[OK] QA186: map-first waiting, accessible PIN, no fabricated profile, callbacks preserved.");
