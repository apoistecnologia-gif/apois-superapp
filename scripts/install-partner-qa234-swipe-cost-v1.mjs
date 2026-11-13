// APOIS_PARTNER_QA234_SWIPE_COST_V1.
// Applied after external-nav v1 and after protected QA222/Courier maps.
// Changes ONLY disposable Motorista/Entregador workspaces.
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
export const marker="APOIS_PARTNER_QA234_SWIPE_COST_V1";
function once(s,from,to,label){
 const count=s.split(from).length-1;
 if(count!==1)throw Error("[FAIL] QA234 "+label+" count="+count);
 return s.replace(from,to);
}
function replaceButton(s,needle,replacement,label,fromIndex=0){
 const idx=s.indexOf(needle,fromIndex);
 if(idx<0||s.indexOf(needle,idx+needle.length)>=0)throw Error("[FAIL] QA234 "+label+" handler absent/ambiguous");
 const a1=s.lastIndexOf("<button",idx),a2=s.lastIndexOf("<DSButton",idx),a3=s.lastIndexOf("<Button",idx);
 const candidates=[{begin:a1,close:"</button>"},{begin:a2,close:"</DSButton>"},{begin:a3,close:"</Button>"}]
  .filter(x=>x.begin>=0).sort((x,y)=>y.begin-x.begin);
 if(!candidates.length)throw Error("[FAIL] QA234 "+label+" start missing");
 const {begin,close}=candidates[0];
 // Do not span a preceding component boundary: the callback must be inside the tag.
 if(s.slice(begin,idx).includes("</button>")||s.slice(begin,idx).includes("</Button>"))
  throw Error("[FAIL] QA234 "+label+" is outside selected button");
 const end=s.indexOf(close,idx);
 if(end<0)throw Error("[FAIL] QA234 "+label+" closing tag missing");
 return s.slice(0,begin)+replacement+s.slice(end+close.length);
}
function driver(s){
 for(const t of ["APOIS_PARTNER_EXTERNAL_NAV_UI_V1","data-apois-qa221-trip-hud",
   "onClick={onAccept}","onClick={onReject}","onClick={handleArrive}","onClick={handleComplete}",
   "onClick={() => void submitPin()}","await onStart(pinCode);","setPolyline(points);",
   'const refreshDue = !samePhase || (elapsedMs >= 180000 &&']){
  if(!s.includes(t))throw Error("[FAIL] QA234 Motorista prerequisite "+t);
 }
 if(s.includes(marker))throw Error("[FAIL] QA234 Motorista already transformed");
 s="// "+marker+": deliberate swipe controls + external autopilot after confirmed server PIN.\n"+
  'import { ApoisSlideAction, ApoisOfferSwipe } from "@/components/ApoisSwipeControls";\n'+s;
 s=once(s,
  'import { ApoisExternalNavigation, useApoisOperationalNotification } from "@/components/ApoisExternalNavigation";',
  'import { ApoisExternalNavigation, useApoisOperationalNotification, launchApoisNavigationAfterRideStart } from "@/components/ApoisExternalNavigation";',
  "auto-launch import"
 );
 // Preserve original PIN/server start operation. Only launch Android after
 // backend call onStart() resolves. A failed map launch never rejects the ride.
 const pinCommit=[
  "      await onStart(pinCode);",
  "      setPinOpen(false);",
  '      setPinCode("");',
 ].join("\n");
 const updatedPin=[
  "      await onStart(pinCode);",
  "      setPinOpen(false);",
  '      setPinCode("");',
  "      // QA234: the ride is already active on the backend at this point.",
  "      // Opening Waze/Google is auxiliary: it may fail without changing ride status.",
  "      void launchApoisNavigationAfterRideStart(ride.destination_lat, ride.destination_lng)",
  "        .catch((error) => {",
  "          console.warn('[APOIS] Corrida iniciada; navegação externa não abriu.',error);",
  '          toast.info("Corrida iniciada. Use Iniciar navegação para tentar novamente.");',
  "        });",
 ].join("\n");
 s=once(s,pinCommit,updatedPin,"PIN server ACK → auto external map");
 // Offer: one bidirectional thumb, left reject / right accept, no accidental tap.
 const offerStart=s.indexOf("function IncomingOffer("), offerEnd=offerStart<0?-1:s.indexOf("\nfunction InfoCard(",offerStart);
 const offerLimit=offerEnd>offerStart?offerEnd:s.indexOf("\nfunction ",offerStart+20);
 if(offerStart<0||offerLimit<=offerStart)throw Error("[FAIL] QA234 IncomingOffer bounds");
 let offer=s.slice(offerStart,offerLimit);
 // Offer footer was restyled in QA190/QA195: identify real handler pair
 // rather than depending on one historical Tailwind class.
 const rejectAt=offer.indexOf("onClick={onReject}"),acceptAt=offer.indexOf("onClick={onAccept}");
 if(rejectAt<0||acceptAt<=rejectAt||offer.indexOf("onClick={onReject}",rejectAt+1)>=0)
   throw Error("[FAIL] QA234 IncomingOffer reject/accept unique pair");
 const rowBegin=offer.lastIndexOf("<div",rejectAt),rowEnd=offer.indexOf("</div>",acceptAt);
 const originalRow=offer.slice(rowBegin,rowEnd+6);
 if(rowBegin<0||rowEnd<=acceptAt||rowEnd-rowBegin>2600||
    !originalRow.includes("Recusar")||!originalRow.includes("Aceitar"))
   throw Error("[FAIL] QA234 IncomingOffer action footer bounds");
 offer=offer.slice(0,rowBegin)+
  '<ApoisOfferSwipe acceptLabel="Aceitar corrida" rejectLabel="Recusar" onAccept={onAccept} onReject={onReject} />'+
  offer.slice(rowEnd+6);
 s=s.slice(0,offerStart)+offer+s.slice(offerLimit);
 // Pre-PIN "Iniciar corrida" opens existing PIN dialog. Keep PIN validation intact.
 const openPin='<ActionButton label="Iniciar corrida" onClick={() => { setPinError(null); setPinCode(""); setPinOpen(true); }} icon={ChevronRight} emphasize />';
 const openSlide='<ApoisSlideAction label="Iniciar corrida" onConfirm={() => { setPinError(null); setPinCode(""); setPinOpen(true); }} />';
 s=once(s,openPin,openSlide,"pre-PIN ride action slider");
 // The original PIN dialog must remain fully validated, including its error display.
 s=replaceButton(s,"onClick={() => void submitPin()}",
   '<ApoisSlideAction label="Confirmar PIN e iniciar corrida" onConfirm={submitPin} disabled={pinBusy || pinCode.length !== 4} busy={pinBusy} className="min-w-0" />',
   "PIN submit slider");
 // Navigation flow controls: swipe to confirm arrival/finish, keep cancellation separate.
 s=replaceButton(s,"onClick={handleArrive}",
   '<ApoisSlideAction label="Confirmar chegada" onConfirm={handleArrive} disabled={arriveBusy} busy={arriveBusy} />',
   "driver arrival slider");
 s=replaceButton(s,"onClick={handleComplete}",
   '<ApoisSlideAction label="Finalizar corrida" onConfirm={handleComplete} disabled={busy} busy={busy} />',
   "driver finish slider");
 // QA233 still checked road/ETA every 180 sec if the car moved 450 m.
 // External providers now recalculate their own turn-by-turn. Keep business
 // plausibility + initial ETA and bounded recovery, decrease only paid refreshes.
 const oldRefresh=[
  "    const refreshDue = !samePhase || (elapsedMs >= 180000 &&",
  "      (movedKm >= 0.45 || (prior?.failed === true && prior.failures < 2)));"
 ].join("\n");
 const newRefresh=[
  "    // "+marker+": operational ETA only. External apps calculate live navigation.",
  "    // No more than one ordinary update per 15 min AND >=1.5 km; bounded retry after failure.",
  "    const refreshDue = !samePhase",
  "      || (elapsedMs >= 900000 && movedKm >= 1.5)",
  "      || (elapsedMs >= 180000 && prior?.failed === true && prior.failures < 2);"
 ].join("\n");
 s=once(s,oldRefresh,newRefresh,"Motorista operational Routes request throttle");
 for(const t of ["data-apois-driver-main-map-owner","data-apois-qa220-pin-digit-v1","data-apois-qa221-trip-hud",
  'ApoisExternalNavigation latitude={ride.destination_lat}',"await onStart(pinCode);",
  "launchApoisNavigationAfterRideStart(ride.destination_lat, ride.destination_lng)",
  "onConfirm={submitPin}","onConfirm={handleComplete}","onConfirm={handleArrive}",
  "onAccept={onAccept} onReject={onReject}","onClick={onShowRoute}","onClick={onRecenter}",
  "setPolyline(points);","elapsedMs >= 900000","prior.failures < 2"]){
  if(!s.includes(t))throw Error("[FAIL] QA234 Motorista preserved "+t);
 }
 return s;
}
function courier(map,app,premium,offers){
 if(!map.includes("APOIS_PARTNER_EXTERNAL_NAV_UI_V1")||!app.includes("APOIS_PARTNER_EXTERNAL_NAV_UI_V1"))
  throw Error("[FAIL] QA234 Courier requires external nav QA233");
 if(premium.includes(marker)||offers.includes(marker))throw Error("[FAIL] QA234 Courier duplicate transform");
 // The current full-screen offer belongs to CourierOfferOverlay, not the
 // legacy CourierPremiumViews offer card. Its original respond() RPC stays.
 for(const term of ['onClick={() => void respond("reject")}', 'onClick={() => void respond("accept")}']){
  if(!offers.includes(term))throw Error("[FAIL] QA234 CourierOfferOverlay RPC "+term);
 }
 offers="// "+marker+": real Courier offer modal retains respond() server calls and timeout.\n"+
   'import { ApoisOfferSwipe } from "@/components/ApoisSwipeControls";\n'+offers;
 const reject=offers.indexOf('onClick={() => void respond("reject")}');
 const accept=offers.indexOf('onClick={() => void respond("accept")}');
 const rowStart=offers.lastIndexOf("<div",reject),rowEnd=offers.indexOf("</div>",accept);
 if(reject<0||accept<=reject||rowStart<0||rowEnd<=accept||rowEnd-rowStart>3000)
  throw Error("[FAIL] QA234 Courier offer footer bounds");
 const original=offers.slice(rowStart,rowEnd+6);
 if(!original.includes("RECUSAR")||!original.includes("ACEITAR ENTREGA"))
  throw Error("[FAIL] QA234 Courier offer footer identity");
 offers=offers.slice(0,rowStart)+
  '<ApoisOfferSwipe acceptLabel="Aceitar entrega" rejectLabel="Recusar" disabled={Boolean(busy)} onAccept={() => respond("accept")} onReject={() => respond("reject")} />'+
  offers.slice(rowEnd+6);
 // The active sheet has been replaced by SimpleJourney after source pinning.
 // Status must still be transitioned via existing onTransition("picked_up").
 for(const term of ['onClick={() => void onTransition("picked_up")}', 'onSubmit={(event) => { event.preventDefault(); if (!busy) void onComplete(); }}',
  'disabled={busy || pin.length !== 4}',"APOIS_COURIER_SIMPLE_FLOW_V1"]){
  if(!premium.includes(term))throw Error("[FAIL] QA234 Courier active flow anchor "+term);
 }
 premium="// "+marker+": collection and PIN-secured delivery via original callbacks.\n"+
   'import { ApoisSlideAction } from "@/components/ApoisSwipeControls";\n'+premium;
 premium=replaceButton(premium,'onClick={() => void onTransition("picked_up")}',
   '<ApoisSlideAction label="Confirmar retirada" disabled={busy} busy={busy} onConfirm={() => onTransition("picked_up")} className="mt-3" />',
   "courier pickup slider");
 // The PIN completion action is a submit Button inside a form. Preserve the
 // form's Enter handler (a11y), but the visible primary action is a swipe.
 premium=replaceButton(premium,'type="submit" disabled={busy || pin.length !== 4}',
   '<ApoisSlideAction label="Confirmar entrega" disabled={busy || pin.length !== 4} busy={busy} onConfirm={onComplete} />',
   "courier PIN delivery completion");
 premium=once(premium,
    'className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2"',
    'className="mt-2 grid grid-cols-1 gap-2"',
    "full-width courier PIN and swipe layout");
 // Preserve transactional delivery metrics and GPS. Paid live routing is
 // opt-in; even if enabled, do not pay for real-time traffic or 3-minute
 // reroutes when external Waze/Google already handles turn-by-turn.
 const old='    if (!targetChanged && (elapsed < 180_000 || moved < 500)) return;';
 const next='    // '+marker+': operational metrics only; external provider owns navigation.\n'+
  '    if (!targetChanged && (elapsed < 900_000 || moved < 1500)) return;';
 map=once(map,old,next,"Courier optional paid Routes cooldown");
 map=once(map,'routingPreference: "TRAFFIC_AWARE",',
  'routingPreference: "TRAFFIC_UNAWARE",',"Courier basic Routes without paid traffic");
 for(const tok of ['ApoisExternalNavigation latitude={target.lat}',"job.pickup_latitude","job.delivery_latitude",
   "update_courier_delivery_route_metrics","VITE_APOIS_ENTREGAS_LIVE_ROUTING"]){
  if(!map.includes(tok))throw Error("[FAIL] QA234 courier map preservation "+tok);
 }
 for(const tok of ["onTransition={transitionDelivery}","onComplete={completeDelivery}",
  'useApoisOperationalNotification("entregador", Boolean(activeJob))']){
  if(!app.includes(tok))throw Error("[FAIL] QA234 courier lifecycle "+tok);
 }
 for(const tok of ['onAccept={() => respond("accept")}','onReject={() => respond("reject")}',
  'onConfirm={() => onTransition("picked_up")}','onConfirm={onComplete}',
  "pin.length !== 4"]){
  if(!(premium+"\n"+offers).includes(tok))throw Error("[FAIL] QA234 courier protected callback "+tok);
 }
 return {map,app,premium,offers};
}
export {driver,courier};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=resolve(".work/partner-"+(process.argv[2]||""));
 if(process.argv[2]==="motorista"){
   const p=resolve(root,"src/routes/motorista.app.tsx");
   const out=driver(readFileSync(p,"utf8"));
   writeFileSync(p,out,"utf8");
 }else if(process.argv[2]==="entregador"){
   const m=resolve(root,"src/components/CourierRouteMap.tsx");
   const a=resolve(root,"src/routes/courier.tsx");
   const p=resolve(root,"src/components/CourierPremiumViews.tsx");
   const o=resolve(root,"src/components/CourierOfferOverlay.tsx");
   const out=courier(readFileSync(m,"utf8"),readFileSync(a,"utf8"),readFileSync(p,"utf8"),readFileSync(o,"utf8"));
   writeFileSync(m,out.map,"utf8");writeFileSync(a,out.app,"utf8");
   writeFileSync(p,out.premium,"utf8");writeFileSync(o,out.offers,"utf8");
 }else throw Error("[FAIL] QA234 expects motorista|entregador");
 console.log("[OK] "+marker+" "+process.argv[2]+": swipe operations, PIN auto-launch, paid-route throttling");
}
