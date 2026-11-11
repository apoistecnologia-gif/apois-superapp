// APOIS_DRIVER_QA195_PHYSICAL_UX_V1: Android physical-video visual audit.
// Only disposable Motorista workspace, no source-lock, Entregador or ride RPC changes.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(root,"src/routes/motorista.app.tsx"),cssFile=resolve(root,"src/styles.css");
let s=readFileSync(file,"utf8"),css=readFileSync(cssFile,"utf8");
const marker="APOIS_DRIVER_QA195_PHYSICAL_UX_V1";
if(s.includes(marker)||css.includes(marker))throw Error("[FAIL] QA195 applied twice");
function once(source,old,next,label){
 const n=source.split(old).length-1;
 if(n!==1)throw Error("[FAIL] QA195 "+label+" anchors="+n);
 return source.replace(old,next);
}
function between(start,end,label,fn){
 const a=s.indexOf(start),b=a<0?-1:s.indexOf(end,a+start.length);
 if(a<0||b<=a)throw Error("[FAIL] QA195 component "+label);
 const before=s.slice(a,b),after=fn(before);
 if(before===after)throw Error("[FAIL] QA195 unchanged "+label);
 s=s.slice(0,a)+after+s.slice(b);
}
// Full legal identity stays untouched in memory/database; only cards use first name.
s=once(s,"const EMPTY_ROUTE: LatLng[] = [];",[
"// "+marker+": display data without changing identity.",
"function passengerFirstName(name: string | null | undefined): string {",
'  const value = typeof name === "string" ? name.trim() : "";',
'  return value ? value.split(/\\s+/u)[0] : "Passageiro";',
"}",
"function passengerRatingSummary(passenger: Passenger | null): string {",
"  const count=Number(passenger?.total_ratings ?? 0);",
'  if(!Number.isFinite(count)||count<=0)return "Sem avaliações";',
"  const n=Math.trunc(count);",
'  return passengerRatingText(passenger)+" · "+n+(n===1?" avaliação":" avaliações");',
"}",
"const EMPTY_ROUTE: LatLng[] = [];"
].join("\n"),"passenger helpers");
// Assigned ride remains driver-scoped. Offer preview is limited to dispatched offer.
const a=s.indexOf("  // APOIS_ASSIGNED_PASSENGER_V6:"),b=s.indexOf("  // countdown da oferta",a);
if(a<0||b<=a)throw Error("[FAIL] QA195 passenger effect missing");
let effect=s.slice(a,b);
effect=once(effect,"    let cancelled = false;",
 "    let cancelled = false;\n    // Do not show data from a previous ride during lookup.\n    setPassenger(null);","stale passenger");
effect=once(effect,
 '      if (!record) {\n        const response = await supabase.from("users")',
 [
 '      if (!record && incoming?.id) {',
 '        try {',
 '          const preview = await (supabase as any).rpc("apois_driver_offer_passenger", { p_ride_id: incoming.id });',
 '          if (!preview.error && Array.isArray(preview.data) && preview.data[0]) {',
 '            const row = preview.data[0] as { name?: string | null; avatar_url?: string | null; average_rating?: number | null; total_ratings?: number | null };',
 '            record = { name: row.name ?? null, phone: null, avatar_url: row.avatar_url ?? null,',
 '              average_rating: row.average_rating ?? null, total_ratings: row.total_ratings ?? 0 };',
 '          }',
 '        } catch { /* keep RLS-controlled fallback */ }',
 '      }',
 '      if (!record) {',
 '        const response = await supabase.from("users")'
 ].join("\n"),"authorized offer preview");
effect=once(effect,"ratingRide?.passenger_id, incoming?.passenger_id]);",
  "ratingRide?.passenger_id, incoming?.passenger_id, incoming?.id]);","offer id dependency");
s=s.slice(0,a)+effect+s.slice(b);
// Do not display surname anywhere in the operational cards.
const full='{passenger?.name ?? "Nome indisponível"}',n=s.split(full).length-1;
if(n<2||n>20)throw Error("[FAIL] QA195 name displays count="+n);
s=s.replaceAll(full,"{passengerFirstName(passenger?.name)}");
const av='name={passenger?.name ?? ""}',avatarCount=s.split(av).length-1;
if(avatarCount<3||avatarCount>15)throw Error("[FAIL] QA195 avatar count="+avatarCount);
s=s.replaceAll(av,'name={passenger?.name ? passengerFirstName(passenger.name) : ""}');
between("function IncomingOffer(","\nfunction InfoCard(","offer",offer=>{
 offer=once(offer,'style={{ maxHeight: "min(68dvh, 540px)" }}',
  'style={{ maxHeight: "min(48dvh, 440px)" }}',"offer exposes map");
 offer=once(offer,'data-apois-driver-offer-readable-v7 className=',
  'data-apois-driver-offer-readable-v7 data-apois-driver-offer-qa195="true" className=',"offer marker");
 // Preserve the existing backdrop opacity; earlier visual hardeners already tune it.
 offer=once(offer,'className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 sm:px-5"',
  'className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 sm:px-5"',"offer scroll");
 offer=once(offer,'const ratingText = passengerRatingText(passenger, 2);',
  'const ratingText = passengerRatingSummary(passenger);',"offer stars count");
 for(const x of ["AddressRow","onClick={onAccept}","onClick={onReject}","CountdownRing","estimated_price","src={passenger?.avatar_url"])
  if(!offer.includes(x))throw Error("[FAIL] QA195 offer lost "+x);
 return offer;
});
between("function ActiveRidePanel(","\nfunction ActionButton(","PIN",panel=>{
 panel=once(panel,
  '<label htmlFor="apois-motorista-pin-v4" className="block cursor-text">',
  '<label htmlFor="apois-motorista-pin-v4" className="block cursor-text" onClick={() => document.getElementById("apois-motorista-pin-v4")?.focus()}>',
  "PIN focus by touch");
 panel=once(panel,
  ': "flex h-[62px] min-w-0 items-center justify-center rounded-[15px] border-2 border-[#D0D5DD] bg-[#F9FAFB] text-[30px] font-extrabold tabular-nums text-[#111827]"',
  ': position === Math.min(pinCode.length, 3)\n                          ? "flex h-[62px] min-w-0 items-center justify-center rounded-[15px] border-2 border-[#C9141B] bg-[#FFF1F2] text-[30px] font-extrabold tabular-nums text-[#111827] ring-2 ring-[#C9141B]/20"\n                          : "flex h-[62px] min-w-0 items-center justify-center rounded-[15px] border-2 border-[#D0D5DD] bg-[#F9FAFB] text-[30px] font-extrabold tabular-nums text-[#111827]"',
  "active digit square");
 panel=once(panel,
  'aria-label="Digite os quatro dígitos do PIN de segurança"',
  'aria-label="Digite os quatro dígitos do PIN de segurança"\n                    aria-describedby="apois-qa195-pin-hint"',
  "PIN screen reader");
 panel=once(panel,
  '                </label>\n              </div>\n              {pinError &&',
  '                </label>\n                <p id="apois-qa195-pin-hint" className="mt-3 text-center text-[13px] font-semibold text-[#A4141C]">Toque em qualquer quadradinho para digitar o PIN</p>\n              </div>\n              {pinError &&',
  "PIN clear instruction");
 for(const x of ["onStart(pinCode)","onClick={() => void submitPin()}","maxLength={4}","onKeyDown={(event) =>"])
  if(!panel.includes(x))throw Error("[FAIL] QA195 PIN lost "+x);
 return panel;
});
// Existing scores and avatar are genuine, not fabricated.
if(s.includes("{passengerRatingText(passenger)}"))
 s=s.replaceAll("{passengerRatingText(passenger)}","{passengerRatingSummary(passenger)}");
// Top HUDs remain readable but lose large padding and shadow.
for(const tag of ["data-apois-pickup-top-v4","data-apois-trip-top-v6"])
 if(!s.includes(tag))throw Error("[FAIL] QA195 HUD missing "+tag);
css+="\n/* "+marker+": presentation only. */\n"+[
 "[data-apois-pickup-top-v4],[data-apois-trip-top-v6]{padding-left:10px!important;padding-right:10px!important}",
 "[data-apois-pickup-top-v4]>div,[data-apois-trip-top-v6]>div{max-width:390px;margin-inline:auto;padding:8px 12px!important;border-radius:16px!important;box-shadow:0 7px 18px -13px rgba(17,24,39,.35)!important}",
 "[data-apois-pickup-top-v4] .h-9.w-px,[data-apois-trip-top-v6] .h-9.w-px{height:22px!important}",
 "[data-apois-pickup-top-v4] .mb-2,[data-apois-trip-top-v6] .mb-2{margin-bottom:3px!important}",
 "[data-apois-driver-offer-qa195]{overscroll-behavior:contain}",
 "[data-apois-driver-offer-qa195] [class*='overflow-y-auto']{scrollbar-width:thin}",
 "[data-apois-pin-v4] label{touch-action:manipulation}",
 "[data-apois-pin-v4] input:focus-visible{outline:0}",
 "[data-apois-pin-v4] label:focus-within [aria-hidden='true']>span{outline-offset:1px}",
 "@media(max-width:360px){[data-apois-pickup-top-v4]>div,[data-apois-trip-top-v6]>div{padding:7px 8px!important}}"
].join("\n")+"\n";
writeFileSync(file,s,"utf8");writeFileSync(cssFile,css,"utf8");
console.log("[OK] QA195 Motorista: compact offer/HUD, first name+ratings, real avatar, explicit PIN touch.");
