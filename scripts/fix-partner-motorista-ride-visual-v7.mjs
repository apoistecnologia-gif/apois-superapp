// APOIS_DRIVER_RIDE_VISUAL_V7 — only UI in isolated .work/partner-motorista.
// Surgical fixes based on Android screenshots; preserves all ride/dispatch/rating RPCs.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const path=resolve(root,"src/routes/motorista.app.tsx");
let src=readFileSync(path,"utf8");
if(src.includes("data-apois-driver-rating-readable-v7"))throw Error("[FAIL] Driver V7 was applied twice");
function between(source,start,end,label,update){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 if(a<0||b<a)throw Error("[FAIL] Driver V7 component boundary "+label);
 return source.slice(0,a)+update(source.slice(a,b))+source.slice(b);
}
function replaceOne(source,old,next,label){
 const n=source.split(old).length-1;
 if(n!==1)throw Error("[FAIL] Driver V7 "+label+" anchors="+n);
 return source.replace(old,next);
}
// Offer screen: do not place the R$ headline below the Android status bar.
// Keep offer timeout, pricing, category, passenger and accept/reject callbacks.
src=between(src,"function IncomingOffer(","function InfoCard(","IncomingOffer",s=>{
 s=replaceOne(s,
  'className="fixed inset-x-0 top-0 z-50',
  'data-apois-driver-offer-readable-v7 className="fixed inset-x-0 top-[max(56px,env(safe-area-inset-top))] z-50',
  "offer top inset");
 s=replaceOne(s,'style={{ maxHeight: "min(94dvh, 680px)" }}',
  'style={{ maxHeight: "100%" }}',"offer viewport height");
 s=replaceOne(s,'className="relative flex w-full max-w-md flex-col',
  'className="relative flex min-h-0 w-full max-w-md flex-col',"offer scroll contract");
 s=s.replaceAll('bg-background/40','bg-[#F8FAFC]').replaceAll('text-muted-foreground','text-[#596474]').replaceAll('text-foreground','text-[#111827]');
 s=s.replaceAll('bg-card','bg-white').replaceAll('border-border','border-[#E2E4E8]');
 // Explicit white bottom bar; older theme provided black footer under a white offer.
 s=s.replace('border-t border-white/5 bg-[#08090A]','border-t border-[#E2E4E8] bg-white');
 for(const v of ['onClick={onAccept}','onClick={onReject}','{ride.estimated_price','data-apois-driver-offer-readable-v7','<InfoCard','<AddressRow'])if(!s.includes(v))throw Error("[FAIL] Offer flow lost "+v);
 return s;
});
// Critical active route top card must be below native Android system status
// even on edge-to-edge WebViews with env(safe-area-inset-top) reporting 0px.
const topFrom='top: "calc(env(safe-area-inset-top) + 12px)"';
const topTo='top: "max(56px, calc(env(safe-area-inset-top) + 12px))"';
const previousCount=src.split(topFrom).length-1;
if(previousCount<1||previousCount>8)throw Error("[FAIL] Driver top UI anchoring unexpectedly changed");
src=src.replaceAll(topFrom,topTo);
// Route failure remains surfaced, but no repeated large notification obscuring ETA.
src=replaceOne(src,
 'toast.message("Não foi possível traçar a rota agora. Use navegação externa.");',
 'toast.warning("Rota indisponível. Use a navegação externa.", { id: "apois-driver-route", duration: 3000 });',
 "short route warning");
const ratingState='  const [ratingRide, setRatingRide] = useState<RideRow | null>(null);';
src=replaceOne(src,ratingState,ratingState+
 '\n  // APOIS_DRIVER_RIDE_VISUAL_V7: route warnings cannot cover completion/rating.\n  useEffect(() => { if (ratingRide) toast.dismiss("apois-driver-route"); }, [ratingRide?.id]);',
 "dismiss obsolete route notification on completed ride");
// Complete view: dark-design token names were rendered as near-white text on
// gray blocks after APOIS migrated to a light surface. Use explicit colors
// ONLY inside RatingScreen, not global CSS/route logic.
src=between(src,"function RatingScreen(","function SummaryRow(","RatingScreen",s=>{
 // Prior mobile hardeners can modify overlay tone/animation. Match the RatingScreen backdrop structurally.
 const overlay=s.match(/className="fixed inset-0[^"]*items-end justify-center[^"]*"/);
 if(!overlay)throw Error("[FAIL] Driver V7 RatingScreen backdrop missing");
 s=s.replace(overlay[0],
 'data-apois-driver-rating-readable-v7 className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 animate-in fade-in duration-300"');
 const panelMatch=s.match(/className="[^"]*max-h-\[calc\(100dvh-max\(env\(safe-area-inset-top\),12px\)\)\][^"]*ring-1 ring-border animate-sheet-in"/);
 if(!panelMatch)throw Error("[FAIL] Rating mobile modal width and safe-area anchor missing");
 s=s.replace(panelMatch[0],
 'className="max-h-[calc(100dvh-max(56px,env(safe-area-inset-top)))] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[28px] border border-[#E2E4E8] bg-white px-5 pt-5 pb-[max(52px,env(safe-area-inset-bottom))] text-[#111827] shadow-[0_-14px_40px_-20px_rgba(17,24,39,0.22)] animate-sheet-in"');
 // Explicit light palette and guaranteed contrast across BOTH submitted and
 // pre-submit branches; no state, callback, request, or rating values edited.
 for(const [a,b] of [
  ["bg-background/70","bg-[#F8FAFC]"],["bg-background/60","bg-[#F8FAFC]"],
  ["bg-card","bg-white"],["text-foreground","text-[#111827]"],
  ["text-muted-foreground","text-[#5B6470]"],["ring-border","ring-[#E2E4E8]"],
  ["border-border/60","border-[#D9DEE6]"],["bg-primary/10","bg-[#FFF1F2]"],
  ["ring-primary/25","ring-[#FBCAD0]"],
 ])s=s.replaceAll(a,b);
 s=s.replace('className="mt-2.5 w-full resize-none rounded-[14px] bg-white p-2.5 text-[13px] ring-1 ring-[#E2E4E8] focus:outline-none focus:ring-primary/40"',
   'className="mt-2.5 w-full resize-none rounded-[14px] bg-white p-3 text-[13px] font-medium text-[#111827] placeholder:text-[#8A9098] ring-1 ring-[#D1D5DB] focus:outline-none focus:ring-[#E51B23]/40"');
 s=s.replace('className="mt-4 w-full"','className="mt-4 w-full bg-[#E51B23] text-white hover:bg-[#C9141B]"');
 s=s.replace('className="mt-5 w-full"','className="mt-5 w-full bg-[#E51B23] text-white hover:bg-[#C9141B]"');
 for(const v of ['data-apois-driver-rating-readable-v7','onClick={onSubmit}','onClick={onDismiss}','onClick={onSkip}',
  'onClick={() => setStars(n)}','{formatBRL(total)}','{paymentLabel}','value={comment}','onChange={(e) => setComment(e.target.value)}',
  'Como foi o passageiro?','Pronto para novas corridas']){
  if(!s.includes(v))throw Error("[FAIL] Rating functionality lost "+v);
 }
 if(s.includes('text-muted-foreground')||s.includes('bg-background/'))throw Error("[FAIL] Rating old dark-theme tokens persist");
 return s;
});
// Terminal summary rows and the top ETA cells are independent components;
// fix their inherited white-on-white labels without changing data values.
src=between(src,"function SummaryRow(","function TopStat(","SummaryRow",s=>{
 s=s.replaceAll("text-muted-foreground","text-[#5B6470]").replaceAll("text-foreground","text-[#111827]");
 if(!s.includes("text-[#111827]")||!s.includes("text-[#5B6470]"))throw Error("[FAIL] Rating summary labels not accessible");
 return s;
});
src=between(src,"function TopStat(","function ","TopStat",s=>{
 // Earlier visual hardeners may have replaced the old token with text-white/90.
 // The statistics header is always on white in the final partner layout.
 const color=s.match(/highlight\s*\?\s*"[^"]+"\s*:\s*"[^"]+"/);
 if(!color)throw Error("[FAIL] TopStat highlight/normal value colors missing");
 s=s.replace(color[0], 'highlight ? "text-[#C81924]" : "text-[#344054]"');
 for(const muted of ["text-muted-foreground","text-zinc-400","text-[#666B73]"]){
  s=s.replaceAll(muted,"text-[#5B6470]");
 }
 if(!s.includes("text-[#344054]")||!s.includes("text-[#5B6470]"))throw Error("[FAIL] Top navigation ETA labels are unreadable");
 return s;
});
for(const check of [
 'data-apois-driver-offer-readable-v7','data-apois-driver-rating-readable-v7',
 'top: "max(56px, calc(env(safe-area-inset-top) + 12px))"',
 'toast.dismiss("apois-driver-route")','toast.warning("Rota indisponível. Use a navegação externa."',
 'const completedRide = await callComplete',
 'setRatingRide(completedRide);','ratingRef.current = completedRide;',
])if(!src.includes(check))throw Error("[FAIL] Driver V7 expected contract missing "+check);
writeFileSync(path,src,"utf8");
console.log("[OK] Driver V7 visual: offer cleared of status bar, route warning compact, post-finish rating legible with preserved server calls.");
