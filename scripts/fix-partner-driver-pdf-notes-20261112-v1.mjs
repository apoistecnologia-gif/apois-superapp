// APOIS_DRIVER_PDF_20261112_V1
// Aplicar APENAS depois de QA209, na copia descartavel .work/partner-motorista.
// Origem: imagens_EDITADAS.pdf, paginas 1-6. Sem alterar Supabase, PIN, valores,
// corridas, pagamento, Entregador, chaves Google ou APK.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const path=resolve(root,"src/routes/motorista.app.tsx");
const cssPath=resolve(root,"src/styles.css");
let source=readFileSync(path,"utf8"), css=readFileSync(cssPath,"utf8");
const marker="APOIS_DRIVER_PDF_20261112_V1";
if(source.includes(marker)||css.includes(marker))throw Error("[FAIL] PDF patch repeated");
for(const requireMarker of ["APOIS_DRIVER_QA209_REAL_PIN_V1","APOIS_DRIVER_QA201_ROUTE_RELIABILITY_V1","data-apois-trip-top-v6","data-apois-waiting-actions-v1","APOIS_DRIVER_QA186_NAV_LAYOUT_V1"]) {
  if(!source.includes(requireMarker))throw Error("[FAIL] Missing base protection: "+requireMarker);
}
function replaceOnce(text,from,to,reason) {
  const count=text.split(from).length-1;
  if(count!==1)throw Error("[FAIL] PDF UI "+reason+" anchor="+count);
  return text.replace(from,to);
}
function component(begin,end,reason,fn) {
  const a=source.indexOf(begin);
  const b=a<0?-1:(end==="__EOF__"?source.length:source.indexOf(end,a+begin.length));
  if(a<0||b<=a)throw Error("[FAIL] PDF UI section "+reason);
  const old=source.slice(a,b),updated=fn(old);
  if(old===updated)throw Error("[FAIL] PDF UI unchanged: "+reason);
  source=source.slice(0,a)+updated+source.slice(b);
}

// P1 — the 44dvh offer hid passenger identity and comfort preferences.
// Keep the timer, accepted price, accept/reject, score and original scrolling.
component("function IncomingOffer(","\nfunction InfoCard(","P1 expanded offer",block=>{
  block=replaceOnce(block,'  const pct = (countdown / RIDE_OFFER_TIMEOUT_SECONDS) * 100;',
   '  // '+marker+': expanded only by the driver, does not pause offer countdown.\n'+
   '  const [offerExpanded, setOfferExpanded] = useState(false);\n'+
   '  const pct = (countdown / RIDE_OFFER_TIMEOUT_SECONDS) * 100;', "offer expansion state");
  block=replaceOnce(block,'style={{ maxHeight: "min(44dvh, 410px)" }}',
   'data-apois-offer-expandable-v1="true" style={{ maxHeight: offerExpanded ? "calc(100dvh - max(64px, env(safe-area-inset-top)) - max(90px, env(safe-area-inset-bottom)))" : "min(56dvh, 520px)" }}', "offer flexible height");
  const anchor='          {/* Passageiro — nome + rating */}';
  const control=[
   '          {/* '+marker+': the lower part remains scrollable, while decisions stay pinned. */}',
   '          <button type="button" aria-expanded={offerExpanded} onClick={() => setOfferExpanded((open) => !open)}',
   '            className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[13px] font-bold text-[#344054]">',
   '            {offerExpanded ? "Recolher detalhes" : "Ver passageiro e preferências"}',
   '          </button>',
   ''
  ].join("\n");
  block=replaceOnce(block,anchor,control+anchor,"offer expand button");
  for(const tok of ["onClick={onAccept}","onClick={onReject}","CountdownRing","onClick={onOpenProfile}","<ApoisRideComfortCard","overflow-y-auto"])if(!block.includes(tok))throw Error("[FAIL] Offer lost "+tok);
  return block;
});

// P2 — keep the passenger profile and phone actions, but remove the duplicated
// full passenger identity card on the on-the-way map.
component("function PickupNavOverlay(","\nfunction CircleAction(","P2 pickup panel",block=>{
  const start=block.indexOf('          <button type="button" onClick={onOpenProfile}');
  const end=start<0?-1:block.indexOf('          </button>',start);
  if(start<0||end<=start)throw Error("[FAIL] Pickup passenger card bounds");
  const card=block.slice(start,end);
  if(!card.includes('aria-label="Ver perfil do passageiro"')||!card.includes('href={passenger?.phone'))throw Error("[FAIL] Pickup profile/call actions changed");
  const compact=[
   '          {/* '+marker+': no repeated name/photo while navigating to pickup. */}',
   '          <div data-apois-pickup-compact-v1 className="flex min-h-10 items-center justify-between gap-2">',
   '            <span className="min-w-0 truncate text-[12px] font-medium text-[#475467]">Siga para o embarque</span>',
   '            <div className="flex shrink-0 items-center gap-2">',
   '              <button type="button" onClick={onOpenProfile} className="min-h-10 rounded-lg px-2 text-[12px] font-semibold text-[#C9141B]">Ver perfil</button>',
   '              {passenger?.phone && <a href={`tel:${passenger.phone}`} aria-label="Ligar para o passageiro" className="flex min-h-10 items-center rounded-lg px-2 text-[12px] font-semibold text-[#C9141B]">Ligar</a>}',
   '            </div>',
   '          </div>'
  ].join("\n");
  block=block.slice(0,start)+compact+block.slice(end+'          </button>'.length);
  if(!block.includes('onClick={handleArrive}')||!block.includes('onClick={handleCancel}'))throw Error("[FAIL] Pickup arrival/cancel changed");
  return block;
});

// P3 — when the ride is at the pickup, the legacy draggable sheet stays
// mounted (for modal state) but invisible. Its PIN/actions portals remain active.
// Show a SINGLE fixed waiting+preferences card above the existing CTA.
const parentStart=source.indexOf('{!incoming && !ratingRide && active && active.status !== "motorista_a_caminho"');
const parentEnd=parentStart<0?-1:source.indexOf('{/* ===== Idle',parentStart);
if(parentStart<0||parentEnd<=parentStart)throw Error("[FAIL] Waiting parent render bounds");
let parent=source.slice(parentStart,parentEnd);
const sheetStart='        <MovviSheet ref={sheetRef} snaps={[39, 62, 88]} initial={39}>';
if(parent.split(sheetStart).length!==2)throw Error("[FAIL] Waiting MovviSheet location");
parent=parent.replace(sheetStart,
 '        <div data-apois-waiting-sheet-host-v1="true" className={active.status === "motorista_chegou" ? "invisible pointer-events-none" : "contents"}>\n'+sheetStart);
const sheetEnd='        </MovviSheet>';
parent=replaceOnce(parent,sheetEnd,sheetEnd+'\n        </div>',"waiting sheet close");
source=source.slice(0,parentStart)+parent+source.slice(parentEnd);

// P3/P4/P5 — only ONE waiting summary, hide the no-show CTA while PIN/cancel
// dialogs are open, and stabilize the PIN portal with Android IME.
component("function ActiveRidePanel(","\nfunction ActionButton(","P3-5 waiting+PIN",block=>{
  block=replaceOnce(block,'{isArrived && createPortal(', '{isArrived && !pinOpen && !cancelOpen && createPortal(', "no-show behind PIN");
  const phase='      {/* status pill */}';
  const summary=[
   '      {isArrived && !pinOpen && !cancelOpen && createPortal(',
   '        <section data-apois-waiting-summary-v1 role="status" className="fixed inset-x-3 z-[41] mx-auto max-w-md rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3 text-[#111827] shadow-[0_10px_34px_-18px_rgba(17,24,39,.5)]" style={{bottom:"calc(max(8px, env(safe-area-inset-bottom)) + 138px)",maxHeight:"min(38dvh, 300px)",overflowY:"auto"}}>',
   '          <div className="flex items-center justify-between gap-2">',
   '            <span className="text-[11px] font-extrabold uppercase tracking-[0.11em] text-[#C9141B]">Aguardando passageiro</span>',
   '            <span className="shrink-0 rounded-full bg-[#FEE2E2] px-2 py-1 text-[10px] font-bold text-[#B91C1C]">Peça o PIN</span>',
   '          </div>',
   '          <details className="group mt-2 rounded-xl border border-[#E5E7EB] bg-[#F8FAFC]">',
   '            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 text-[13px] font-semibold text-[#344054] [&::-webkit-details-marker]:hidden">Preferências do passageiro <span aria-hidden="true">›</span></summary>',
   '            <div className="px-3 pb-3"><ApoisRideComfortCard details={ride.service_details} /></div>',
   '          </details>',
   '        </section>, document.body',
   '      )}',
   ''
  ].join("\n");
  block=replaceOnce(block,phase,summary+phase,"fixed summary portal");
  const pinAnchor='className="fixed inset-0 z-[1000] flex items-end justify-center overflow-y-auto overscroll-contain bg-[#101828]/60 pt-[max(8px,env(safe-area-inset-top))] sm:items-center"';
  const pinNext='className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto overscroll-contain bg-[#101828]/60 px-2 pt-[max(12px,env(safe-area-inset-top))] pb-2 sm:items-center"';
  // QA219: keep modal vertically scrollable when the Android IME shrinks the viewport.
  block=replaceOnce(block,pinAnchor,pinNext,"fixed PIN top");
  block=replaceOnce(block,
    'style={{ maxHeight: "calc(100dvh - max(env(safe-area-inset-top), 8px) - 8px)" }}',
    'style={{ maxHeight: "calc(100dvh - max(env(safe-area-inset-top), 12px) - 16px)" }}',
    "PIN panel viewport");
  // QA209's four actual inputs remain separate. Preserve focus, but prevent
  // each next-digit keypress from scrolling and vibrating the whole sheet.
  const count=(block.match(/pinDigitRefs\.current\[[^\]]+\]\?\.focus\(\)/g)||[]).length;
  if(count<2)throw Error("[FAIL] PIN tabbing focus anchors "+count);
  block=block.replace(/(pinDigitRefs\.current\[[^\]]+\]\?\.focus)\(\)/g,'$1({ preventScroll: true })');
  for(const tok of ['onStart(pinCode)','createPortal(','onClick={() => void submitPin()}','data-apois-pin-v4','pinDigitRefs','Confirmar PIN e iniciar corrida'])if(!block.includes(tok))throw Error("[FAIL] PIN contract lost "+tok);
  return block;
});

// P6 — a single top navigation card with compact inline data; no three
// separate metric boxes or extra route cards. Keep Ver rota / Seguir buttons.
component("function ActiveTripNavOverlay(","__EOF__","P6 trip HUD",block=>{
  // The TripOverlay is the only valid visible top HUD in em_viagem.
  const a=block.indexOf('          <div className="flex items-center justify-between gap-2">\n            <TopStat');
  const b=a<0?-1:block.indexOf('\n          </div>',a);
  if(a<0||b<=a)throw Error("[FAIL] Trip TopStat row bounds");
  const oldRow=block.slice(a,b);
  if((oldRow.match(/<TopStat/g)||[]).length!==3)throw Error("[FAIL] Trip expects exactly three metrics");
  const metrics=[
    '          <div data-apois-trip-one-metrics-v1 className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-[#E5E7EB] pt-2 text-[12px] font-bold text-[#344054]">',
    '            <span>{minutes != null ? `${minutes} min` : "ETA indisponível"}</span>',
    '            <span>{legKm != null ? `${legKm.toFixed(1)} km` : "Distância indisponível"}</span>',
    '            <span>{arrivalTime ?? "Chegada indisponível"}</span>',
  ].join("\n");
  block=block.slice(0,a)+metrics+block.slice(b);
  block=replaceOnce(block,
    'data-apois-trip-top-v6 className="pointer-events-auto rounded-[22px] border border-[#E5E7EB] bg-white px-4 py-3 text-[#111827] shadow-lg"',
    'data-apois-trip-top-v6 data-apois-trip-single-hud-v1="true" className="pointer-events-auto overflow-hidden rounded-[22px] border border-[#E5E7EB] bg-white px-3 py-2.5 text-[#111827] shadow-md"',
    "trip single card");
  for(const tok of ["onClick={onShowRoute}","onClick={onRecenter}","onClick={handleComplete}","data-apois-trip-bottom-v6","data-apois-trip-one-metrics-v1"])if(!block.includes(tok))throw Error("[FAIL] Trip flow lost "+tok);
  return block;
});

css += [
  "",
  "/* "+marker+": PDF p1..6 — suppress animation/jitter on PIN keyboard only. */",
  "[data-apois-pin-v4], [data-apois-pin-v4] > div { animation:none!important; transition:none!important; transform:none!important; }",
  "[data-apois-pin-v4] { touch-action:pan-y; overscroll-behavior:contain; }",
  "[data-apois-pin-v4] input { scroll-margin-top:12px; }",
  "[data-apois-waiting-summary-v1] [data-apois-ride-comfort-driver-v1]{ margin-top:0; box-shadow:none; border:0; background:transparent; padding:0; }",
  "[data-apois-waiting-summary-v1] [data-apois-ride-comfort-driver-v1] > p:first-child{display:none}",
  "[data-apois-trip-single-hud-v1] { isolation:isolate; }",
  ""
].join("\n");
for(const tok of [marker,'onClick={onAccept}','onClick={onReject}','onStart(pinCode)','onClick={handleComplete}','APOIS_DRIVER_QA209_CAMERA_V1','APOIS_DRIVER_QA209_REAL_PIN_V1','data-apois-waiting-summary-v1','data-apois-offer-expandable-v1']) {
  if(!source.includes(tok) && !css.includes(tok))throw Error("[FAIL] PDF UI source invariant "+tok);
}
writeFileSync(path,source,"utf8");
writeFileSync(cssPath,css,"utf8");
console.log("[OK] PDF motorista: expanded offer, compact pickup, unique waiting preferences, PIN stable and single trip HUD; no backend or APK.");
