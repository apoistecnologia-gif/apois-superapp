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
 const re=/<div className="grid grid-cols-2 gap-3">[\s\S]*?onClick=\{onReject\}[\s\S]*?onClick=\{onAccept\}[\s\S]*?<\/div>/g;
 const matches=[...offer.matchAll(re)];
 if(matches.length!==1)throw Error("[FAIL] QA234 IncomingOffer action row count "+matches.length);
 offer=offer.replace(re,'<ApoisOfferSwipe acceptLabel="Aceitar corrida" rejectLabel="Recusar" onAccept={onAccept} onReject={onReject} />');
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
function courier(map,app,premium){
 if(!map.includes("APOIS_PARTNER_EXTERNAL_NAV_UI_V1")||!app.includes("APOIS_PARTNER_EXTERNAL_NAV_UI_V1"))
  throw Error("[FAIL] QA234 Courier requires external nav QA233");
 if(premium.includes(marker))throw Error("[FAIL] QA234 Courier duplicate");
 for(const term of ["onClick={() => void onReject(offer.id)}","onClick={() => void onAccept(offer.id)}",
  "onClick={() => void onTransition(action.status)}","onClick={onComplete}"]){
  if(!premium.includes(term))throw Error("[FAIL] QA234 Courier existing callback "+term);
 }
 premium="// "+marker+": delivery offer and status transitions remain in original backend.\n"+
   'import { ApoisOfferSwipe, ApoisSlideAction } from "@/components/ApoisSwipeControls";\n'+premium;
 const os=premium.indexOf("export function CourierOfferCard("),oe=premium.indexOf("\nexport function ActiveDelivery(",os);
 if(os<0||oe<=os)throw Error("[FAIL] QA234 courier offer bounds");
 let offer=premium.slice(os,oe);
 const actionRow=/<div className="mt-4 grid grid-cols-\[0\.8fr_1\.2fr\] gap-3">[\s\S]*?onClick=\{\(\) => void onReject\(offer\.id\)\}[\s\S]*?onClick=\{\(\) => void onAccept\(offer\.id\)\}[\s\S]*?<\/div>/g;
 let hits=[...offer.matchAll(actionRow)];
 if(hits.length!==1)throw Error("[FAIL] QA234 CourierOfferCard row count "+hits.length);
 offer=offer.replace(actionRow,
   '<ApoisOfferSwipe acceptLabel="Aceitar entrega" rejectLabel="Recusar" disabled={busy} onAccept={() => onAccept(offer.id)} onReject={() => onReject(offer.id)} />');
 premium=premium.slice(0,os)+offer+premium.slice(oe);
 premium=replaceButton(premium,"onClick={() => void onTransition(action.status)}",
    '<ApoisSlideAction label={action.label} disabled={busy} busy={busy} onConfirm={() => onTransition(action.status)} className="mt-4" />',
    "courier stage transition");
 premium=replaceButton(premium,"onClick={onComplete}",
    '<ApoisSlideAction label="Confirmar entrega" disabled={busy || pin.length !== 4} busy={busy} onConfirm={onComplete} className="mt-3" />',
    "courier PIN delivery completion");
 // The courier only pays for live route computations when opt-in is true.
 // Retain distance/duration persisted for operational payout, but not
 // continuous secondary navigation every 3m/500m after launch of Waze/Maps.
 const old='    if (!targetChanged && (elapsed < 180_000 || moved < 500)) return;';
 const next='    // '+marker+': operational metrics only, no redundant turn-by-turn polling.\n'+
  '    if (!targetChanged && (elapsed < 900_000 || moved < 1500)) return;';
 map=once(map,old,next,"Courier optional paid Routes cooldown");
 map=once(map,'routingPreference: "TRAFFIC_AWARE",',
  'routingPreference: "TRAFFIC_UNAWARE",',"Courier optional paid Routes basic request");
 for(const t of ["onTransition={transitionDelivery}","onComplete={completeDelivery}",
  'useApoisOperationalNotification("entregador", Boolean(activeJob))']){
  if(!app.includes(t))throw Error("[FAIL] QA234 courier lifecycle "+t);
 }
 for(const t of ["onAccept={() => onAccept(offer.id)}","onReject={() => onReject(offer.id)}",
  "onConfirm={() => onTransition(action.status)}","onConfirm={onComplete}",
  "pin.length !== 4"]){
  if(!premium.includes(t))throw Error("[FAIL] QA234 courier protected "+t);
 }
 return {map,app,premium};
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
   const out=courier(readFileSync(m,"utf8"),readFileSync(a,"utf8"),readFileSync(p,"utf8"));
   writeFileSync(m,out.map,"utf8");writeFileSync(a,out.app,"utf8");writeFileSync(p,out.premium,"utf8");
 }else throw Error("[FAIL] QA234 expects motorista|entregador");
 console.log("[OK] "+marker+" "+process.argv[2]+": swipe operations, PIN auto-launch, paid-route throttling");
}
