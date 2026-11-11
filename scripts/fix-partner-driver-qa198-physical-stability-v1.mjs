// APOIS_DRIVER_QA198_PHYSICAL_STABILITY_V1
// Physical Android QA197 (1001992689.mp4): a huge opaque offer overlay
// covered the map; rating lost genuine profile on ride completion; ended
// rides could continue drawing the red route. This is Motorista-only.
// No source-lock, role switch, billing, PIN validation, map renderer, Entregador,
// GPS or database contract changes.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const path=resolve(root,"src/routes/motorista.app.tsx"),cssPath=resolve(root,"src/styles.css");
let src=readFileSync(path,"utf8"),css=readFileSync(cssPath,"utf8");
const marker="APOIS_DRIVER_QA198_PHYSICAL_STABILITY_V1";
if(src.includes(marker)||css.includes(marker))throw Error("[FAIL] QA198 duplicate patch");
function one(s,old,next,label) {
 const count=s.split(old).length-1;
 if(count!==1)throw Error("[FAIL] QA198 "+label+" anchors="+count);
 return s.replace(old,next);
}
function changeComponent(begin,end,label,fn){
 const a=src.indexOf(begin),b=a<0?-1:(end==="__EOF__"?src.length:src.indexOf(end,a+begin.length));
 if(a<0||b<=a)throw Error("[FAIL] QA198 "+label+" component missing");
 const before=src.slice(a,b),after=fn(before);
 if(before===after)throw Error("[FAIL] QA198 "+label+" unchanged");
 src=src.slice(0,a)+after+src.slice(b);
}
// The visual migration script converted the dark translucent offer backdrop
// to solid #F7F7F8. Fix THAT overlay rather than shrinking the card again.
changeComponent("function IncomingOffer(","\nfunction InfoCard(","offer",s=>{
 s=one(s,"bg-[#F7F7F8] animate-in fade-in duration-200",
   "bg-black/15 animate-in fade-in duration-200","opaque backdrop");
 s=one(s,'className="grid grid-cols-2 gap-3"',
   'className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2.5"',"offer decisions width");
 s=one(s,'<DSButton type="button" size="lg" onClick={onAccept}>',
   '<DSButton type="button" size="lg" className="min-w-0 whitespace-nowrap text-[14px]" onClick={onAccept}>',
   "offer accept text fits one line");
 for(const x of ["data-apois-driver-offer-qa195","onClick={onAccept}","onClick={onReject}","estimated_price","CountdownRing"])
  if(!s.includes(x))throw Error("[FAIL] QA198 offer changed operational contract "+x);
 return s;
});

// Preserve already-authorized passenger identity when the SAME passenger's
// active ride switches to ratingRide. Never show previous passenger on a
// different ride. No SQL/grant expansion is needed for completed rides.
src=one(src,
 '  const [passenger, setPassenger] = useState<Passenger | null>(null);',
 '  const [passenger, setPassenger] = useState<Passenger | null>(null);\n  // '+marker+': do not discard genuine profile for same passenger during rating.\n  const passengerIdentityRef = useRef<string | null>(null);',
 "identity reference");
const lookupStart=src.indexOf("  // APOIS_ASSIGNED_PASSENGER_V6:");
const lookupEnd=lookupStart<0?-1:src.indexOf("  // countdown da oferta",lookupStart);
if(lookupStart<0||lookupEnd<=lookupStart)throw Error("[FAIL] QA198 profile lookup bounds");
let effect=src.slice(lookupStart,lookupEnd);
effect=one(effect,
 '    if (!pid) { setPassenger(null); return; }',
 '    if (!pid) { passengerIdentityRef.current = null; setPassenger(null); return; }',
 "clear after genuine end");
effect=one(effect,
 '    // Do not show data from a previous ride during lookup.\n    setPassenger(null);',
 '    // Only reset the card if this is a DIFFERENT passenger, never on rating transition.\n    const samePassenger = passengerIdentityRef.current === pid;\n    if (!samePassenger) { passengerIdentityRef.current = pid; setPassenger(null); }',
 "no identity flash on completion");
effect=one(effect,
 '      if (!cancelled) setPassenger(record ?? { name: null, phone: null, avatar_url: null, average_rating: null, total_ratings: 0 });',
 '      if (!cancelled) {\n        if (record) setPassenger(record);\n        else if (!samePassenger) setPassenger({ name: null, phone: null, avatar_url: null, average_rating: null, total_ratings: 0 });\n        // If a completed ride can no longer query active-only RPC, keep the\n        // already-authorized passenger details for this exact same passenger.\n      }',
 "keep authorized details in rating");
for(const x of ["apois_driver_assigned_passenger","apois_driver_offer_passenger","mobility","cancelled"]){
 if(x==="mobility")continue;
 if(!effect.includes(x))throw Error("[FAIL] QA198 lost RPC "+x);
}
src=src.slice(0,lookupStart)+effect+src.slice(lookupEnd);

// During the render immediately after completion, state can still contain a
// previously fetched line. Hide it synchronously with active===null; reset
// step/ETA data on effect cleanup too.
src=one(src,
 '{polyline.length > 0 && (',
 '{active && polyline.length > 0 && (',
 "hide completed ride route");
src=one(src,
 '    if (!active) {\n      setPolyline([]);\n      setEtaSeconds(null);',
 '    if (!active) {\n      setPolyline([]);\n      setRouteSteps([]);\n      setEtaSeconds(null);',
 "clear navigation instructions after finish");

// Compact, real passenger rating in both pickup and trip cards, no invented
// review score. No extra row, so the compact cards do not grow.
function addRating(begin,end,label){
 changeComponent(begin,end,label,s=>{
  const re=/<div className="([^"]+)">\{passengerFirstName\(passenger\?\.name\)\}<\/div>/g;
  const matches=[...s.matchAll(re)];
  if(matches.length!==1)throw Error("[FAIL] QA198 "+label+" first-name labels="+matches.length);
  const original=matches[0][0],oldClass=matches[0][1];
  const replacement=[
   '<div className="flex min-w-0 items-center justify-between gap-2">',
   '<span className="'+oldClass+' min-w-0">{passengerFirstName(passenger?.name)}</span>',
   '<span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#A8550F]">',
   '{Number(passenger?.total_ratings ?? 0) > 0 ? <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> : null}',
   '{passengerRatingText(passenger)}</span>',
   '</div>'
  ].join("\n");
  return one(s,original,replacement,label+" rating layout");
 });
}
addRating("function PickupNavOverlay(","\nfunction CircleAction(","pickup");
addRating("function ActiveTripNavOverlay(","__EOF__","trip");

css+="\n/* "+marker+": overlay translucency and hide nonfunctional phone circles. */\n"+
 '[data-apois-driver-offer-qa195]{background:rgba(0,0,0,.12)!important;}\n'+
 '[data-apois-pickup-bottom-v4] a.pointer-events-none,[data-apois-trip-bottom-v6] a.pointer-events-none{display:none!important;}\n';
for(const required of [
 marker,"passengerIdentityRef.current === pid","if (record) setPassenger(record)",
 "{active && polyline.length > 0 && (","setRouteSteps([])",
 "bg-black/15 animate-in","onClick={onAccept}","onClick={onReject}",
 "onStart(pinCode)","onClick={handleComplete}","DriverMapErrorBoundary"
])if(!src.includes(required))throw Error("[FAIL] QA198 contract "+required);
writeFileSync(path,src,"utf8");
writeFileSync(cssPath,css,"utf8");
console.log("[OK] QA198: offer reveals map; same-passenger profile survives rating; ended route hidden; compact star score in pickup and trip.");
