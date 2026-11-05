// APOIS_DRIVER_RIDE_VISUAL_V7 — read-only regression verification.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const route=readFileSync(resolve(root,"src/routes/motorista.app.tsx"),"utf8");
const between=(start,end)=>{
 const a=route.indexOf(start),b=route.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"Missing driver screen component: "+start);
 return route.slice(a,b);
};
const offer=between("function IncomingOffer(","function InfoCard(");
const rating=between("function RatingScreen(","function SummaryRow(");
const summary=between("function SummaryRow(","function TopStat(");
const stats=between("function TopStat(","function ");
assert.ok(offer.includes("data-apois-driver-offer-readable-v7"),"Offer visual marker");
assert.ok(offer.includes('top-[max(56px,env(safe-area-inset-top))]'),"Offer must not overlap Android status bar");
assert.ok(offer.includes('maxHeight: "100%"') && offer.includes("min-h-0"),"Offer remains scrollable within safe viewport");
for(const marker of ["onClick={onAccept}","onClick={onReject}","{ride.estimated_price","<CountdownRing seconds={countdown}","<InfoCard","<AddressRow","paymentLabelFor(ride.payment_method)"])
 assert.ok(offer.includes(marker),"Offer callbacks/data must remain: "+marker);
assert.ok(offer.includes("border-[#E2E4E8] bg-white"),"Offer footer uses readable white surface");
assert.ok(rating.includes("data-apois-driver-rating-readable-v7"),"Completed rating screen marker");
assert.ok(rating.includes("bg-white px-5 pt-5"),"Light completion surface");
assert.ok(rating.includes("text-[#111827]"),"Readable completion text");
assert.ok(rating.includes("max-h-[calc(100dvh-max(56px,env(safe-area-inset-top)))]"),"Rating modal clears Android status bar");
assert.ok(rating.includes("pb-[max(52px,env(safe-area-inset-bottom))]"),"Rating action below system nav bar");
assert.ok(!rating.includes("text-muted-foreground")&&!rating.includes("text-foreground")&&!rating.includes("bg-background/"),"Legacy dark-theme tokens should not reappear on light rating");
for(const marker of [
 "onClick={onSubmit}","onClick={onDismiss}","onClick={onSkip}",
 "onClick={() => setStars(n)}", "value={comment}",
 "onChange={(e) => setComment(e.target.value)}",
 "Como foi o passageiro?","Pronto para novas corridas",
 "{formatBRL(total)}","{distanceLabel}","{durationLabel}",
 "{pickupLabel}","{destinationLabel}","{paymentLabel}",
])assert.ok(rating.includes(marker),"Rating/data must remain "+marker);
for(const comp of [summary,stats])assert.ok(comp.includes("text-[#5B6470]"),"Summary and navigation labels must be legible");
assert.ok(summary.includes("text-[#111827]"),"Rating summary amounts must be legible");
assert.ok(stats.includes("text-[#344054]"),"ETA statistics values must be legible");
assert.ok(route.includes('toast.warning("Rota indisponível. Use a navegação externa.", { id: "apois-driver-route", duration: 3000 });'),"Keep brief, deduped route warning");
assert.ok(route.includes('if (ratingRide) toast.dismiss();'),"Clear old navigation notifications only when rating opens");
assert.ok(!route.includes('toast.message("Não foi possível traçar a rota agora. Use navegação externa.");'),"No old oversized route toast");
assert.ok(route.includes('max(56px, calc(env(safe-area-inset-top) + 12px))'),"Top route status must clear Android status bar");
for(const marker of [
 "const completedRide = await callComplete","ratingRef.current = completedRide",
 "setRatingRide(completedRide);","setActive(null);","setRouteSteps([]);",
 "callStart","callArrive","onComplete={async () =>","callRoute",
 "routeFailToastedRef.current = fitKey","onClick={handleComplete}",
])assert.ok(route.includes(marker),"Driver journey preserved: "+marker);
console.log("[OK] Motorista V7: offer/modal safe areas, readable completed rating & ETA, route warning deduped; accept/start/complete/PIN/realtime/rating preserved.");
