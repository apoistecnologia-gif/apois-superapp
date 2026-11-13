// APOIS_PARTNER_EXTERNAL_NAV_UI_V1.
// Apply LAST on disposable Motorista/Entregador sources after legacy hardeners.
// Existing source-lock pins, Android location services, delivery/ride RPCs untouched.
import {copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {dirname,resolve} from "node:path";
const moduleName=process.argv[2];
if(!["motorista","entregador"].includes(moduleName))throw Error("Usage: node scripts/install-partner-external-navigation-ui.mjs motorista|entregador");
const root=resolve(process.env.APOIS_EXTERNAL_NAV_WORKSPACE || ".work/partner-"+moduleName);
const shared=resolve("superapp/partner-shell/shared/ApoisExternalNavigation.tsx");
const componentPath=resolve(root,"src/components/ApoisExternalNavigation.tsx");
function once(s,old,next,label){
 const n=s.split(old).length-1;if(n!==1)throw Error("[FAIL] ExternalNav "+label+" anchors="+n);
 return s.replace(old,next);
}
if(!existsSync(shared))throw Error("[FAIL] ExternalNav shared module source missing");
mkdirSync(dirname(componentPath),{recursive:true});
copyFileSync(shared,componentPath);

if(moduleName==="motorista"){
 const file=resolve(root,"src/routes/motorista.app.tsx");
 let s=readFileSync(file,"utf8");
 if(s.includes("APOIS_PARTNER_EXTERNAL_NAV_UI_V1"))throw Error("[FAIL] ExternalNav Motorista applied twice");
 for(const t of ["APOIS_DRIVER_QA221_MAP_OWNER_COMPACT_HUD_V1","APOIS_DRIVER_QA222_FOLLOW_REROUTE_V1",
   "function PickupNavOverlay(","function ActiveTripNavOverlay(","data-apois-pickup-bottom-v4","data-apois-trip-bottom-v6",
   "onStart(pinCode)","onClick={onShowRoute}","onClick={onRecenter}","onClick={handleComplete}"]){
  if(!s.includes(t))throw Error("[FAIL] ExternalNav Motorista prerequisite "+t);
 }
 s='// APOIS_PARTNER_EXTERNAL_NAV_UI_V1: navigation external, driver operation stays inside APOIS.\n'+
   'import { ApoisExternalNavigation, useApoisOperationalNotification } from "@/components/ApoisExternalNavigation";\n'+s;
 s=once(s,
   "  const [active, setActive] = useState<RideRow | null>(null);",
   "  const [active, setActive] = useState<RideRow | null>(null);\n"+
   '  useApoisOperationalNotification("motorista", Boolean(active));',
   "notify existing Driver Foreground Service of true active ride");
 const ps=s.indexOf("function PickupNavOverlay("),pe=s.indexOf("\nfunction CircleAction(",ps);
 if(ps<0||pe<=ps)throw Error("[FAIL] ExternalNav Pickup bounds");
 let pickup=s.slice(ps,pe);
 // QA221 replaces the visual label; use the preserved operational callback as anchor.
 const primary=pickup.indexOf("onClick={handleArrive}"),closing=primary<0?-1:pickup.indexOf("</button>",primary);
 if(primary<0||closing<=primary)throw Error("[FAIL] ExternalNav pickup primary CTA missing");
 pickup=pickup.slice(0,closing+9)+
   '\n          <ApoisExternalNavigation latitude={ride.origin_lat} longitude={ride.origin_lng} stage="até o passageiro" />'+
   pickup.slice(closing+9);
 s=s.slice(0,ps)+pickup+s.slice(pe);
 const ts=s.indexOf("function ActiveTripNavOverlay(");
 if(ts<0)throw Error("[FAIL] ExternalNav trip bounds");
 let trip=s.slice(ts);
 const complete=trip.indexOf("onClick={handleComplete}");
 const cta=complete<0?-1:trip.lastIndexOf("<button",complete);
 if(complete<0||cta<0)throw Error("[FAIL] ExternalNav trip finish CTA missing");
 trip=trip.slice(0,cta)+
   '<ApoisExternalNavigation latitude={ride.destination_lat} longitude={ride.destination_lng} stage="até o destino" />\n\n          '+
   trip.slice(cta);
 s=s.slice(0,ts)+trip;

 // No duplicate voice prompts: Google Maps and Waze own turn-by-turn speech.
 const voice=s.indexOf("  // Anuncia manobras conforme o motorista se aproxima.");
 const after=voice<0?-1:s.indexOf("  // Never announce arrival from one GPS proximity reading or an old route.",voice);
 if(voice<0||after<=voice)throw Error("[FAIL] ExternalNav internal maneuver effect not found");
 const oldEffect=s.slice(voice,after);
 if(!oldEffect.includes("tickNavigation(")||!oldEffect.includes("routeSteps.length"))throw Error("[FAIL] Unexpected maneuver voice effect");
 s=s.slice(0,voice)+
   "  // Navigation maneuvers and re-routing are delegated to Google Maps or Waze.\n"+
   "  // Operational arrival/status voice remains in APOIS; no redundant TTS instructions.\n\n"+
   s.slice(after);
 s=once(s,", tickNavigation, type NavStep",", type NavStep","remove unused turn-by-turn voice import");
 // A historical hardener also spoke the FIRST road instruction as soon as
 // the route was fetched; remove this duplicate before Google/Waze speaks it.
 const initialInstruction=/        const firstInstruction = String\(nextSteps\[0\]\?\.instruction \?\? ""\)[^\n]*\n        if \(firstInstruction && [^\n]*\n          void speak\(firstInstruction, [^\n]*\n        \}\n/g;
 if([...s.matchAll(initialInstruction)].length!==1)throw Error("[FAIL] ExternalNav first maneuver voice handler unexpectedly changed");
 s=s.replace(initialInstruction,"");
 // Remove now-obsolete maneuver step buffers and provider step formatting.
 // The operational polyline, ETA, and route-credibility checks remain untouched.
 const stepsBegin=s.indexOf("        const nextSteps = (res.steps ?? []).map(");
 const stepsEnd=stepsBegin<0?-1:s.indexOf("        setRouteStepsPhase(fitKey);",stepsBegin);
 if(stepsBegin<0||stepsEnd<=stepsBegin)throw Error("[FAIL] ExternalNav old route step mapper changed");
 const stepsBlock=s.slice(stepsBegin,stepsEnd);
 if(!stepsBlock.includes("setRouteSteps(nextSteps)")||!stepsBlock.includes("DriverRouteStep"))
  throw Error("[FAIL] ExternalNav expected navigation-only route steps");
 s=s.slice(0,stepsBegin)+"        // External navigation owns road turns; the operational route remains.\n"+
   s.slice(stepsEnd+"        setRouteStepsPhase(fitKey);".length);
 s=once(s,'  const [routeSteps, setRouteSteps] = useState<NavStep[]>([]);\n',"","remove maneuver step React state");
 s=once(s,'  const [routeStepsPhase, setRouteStepsPhase] = useState<string | null>(null);\n',"","remove maneuver status React state");
 s=s.replaceAll("setRouteSteps([]);","");
 s=s.replaceAll("setRouteStepsPhase(null);","");
 s=once(s,'import { computeDriverRoute, type DriverRouteStep } from "@/lib/driverRoutes.mobile";',
   'import { computeDriverRoute } from "@/lib/driverRoutes.mobile";',"remove unused route maneuver type");
 s=once(s,", type NavStep } from \"@/lib/voiceNav\";"," } from \"@/lib/voiceNav\";","remove unused NavStep type");
 if(/\brouteSteps\b|\bsetRouteSteps\b|\brouteStepsPhase\b|\bsetRouteStepsPhase\b|\bDriverRouteStep\b/.test(s))
  throw Error("[FAIL] ExternalNav orphan turn-by-turn state survived");
 const nearVoice=s.indexOf("  // Never announce arrival from one GPS proximity reading or an old route.");
 const nearVoiceEnd=nearVoice<0?-1:s.indexOf("  // Fala transições de status importantes.",nearVoice);
 if(nearVoice<0||nearVoiceEnd<=nearVoice)throw Error("[FAIL] ExternalNav protected arrival voice effect boundary");
 const nearEffect=s.slice(nearVoice,nearVoiceEnd);
 for(const tok of ["destinationEvidenceRef","evidence.travelledKm","evidence.nearFixes","void speak("]){
   if(!nearEffect.includes(tok))throw Error("[FAIL] ExternalNav unexpected arrival voice segment "+tok);
 }
 s=s.slice(0,nearVoice)+"  // Arrival guidance is delegated to Google Maps/Waze; the ride still ends only in APOIS.\n\n"+s.slice(nearVoiceEnd);

 // QA222's <42m off-route billing calls are no longer needed; keep the
 // slower operational ETA/route refresh (QA201) and existing map overlays.
 const geoStart=s.indexOf("// APOIS_DRIVER_QA222_FOLLOW_REROUTE_V1: bounded route geometry.");
 const geoEnd=geoStart<0?-1:s.indexOf("function applyNavigationCamera(",geoStart);
 if(geoStart<0||geoEnd<=geoStart)throw Error("[FAIL] ExternalNav QA222 off-route geometry not found");
 s=s.slice(0,geoStart)+s.slice(geoEnd);
 s=once(s,
   "  const qa222DeviationRef=useRef<Qa222Deviation|null>(null);",
   "",
   "remove obsolete navigation-only deviation tracker");
 // The QA222 status and success code writes reset lines in several scopes.
 // Delete all COMPLETE reset lines, not a substring of another indentation.
 const resets=[...s.matchAll(/^[ \t]*qa222DeviationRef\.current=null;[ \t]*$/gm)];
 if(resets.length<2||resets.length>4)throw Error("[FAIL] ExternalNav unexpected deviation reset count "+resets.length);
 s=s.replace(/^[ \t]*qa222DeviationRef\.current=null;[ \t]*\r?\n/gm,"");
 const oldRoute=[
  "    // APOIS_DRIVER_QA222_FOLLOW_REROUTE_V1: recalculate for sustained off-road movement, with provider cooldown.",
  "    const deviationMeters=isNavigationRideStatus(active.status)&&lastFitKeyRef.current===fitKey&&polyline.length>=2",
  "      ?qa222DistanceToRoute(pos,polyline):Infinity;",
  "    const check=qa222AdvanceDeviation(qa222DeviationRef.current,fitKey,pos,deviationMeters,now,prior?.at??now,prior?.failed===true,prior?.failures??0);",
  "    qa222DeviationRef.current=check.state;",
  "    const offRouteDue=samePhase&&check.reroute;",
  "    const refreshDue=!samePhase||offRouteDue",
  "      || (elapsedMs >= 180000 && (movedKm >= 0.45 || (prior?.failed === true && prior.failures < 2)));"
 ].join("\n");
 const newRoute=[
  "    // External navigation handles deviations; retain only bounded operational ETA refresh.",
  "    const refreshDue = !samePhase || (elapsedMs >= 180000 &&",
  "      (movedKm >= 0.45 || (prior?.failed === true && prior.failures < 2)));"
 ].join("\n");
 s=once(s,oldRoute,newRoute,"remove redundant turn-by-turn route replan");
 for(const required of ["onStart(pinCode)","onClick={handleComplete}","onClick={handleArrive}",
   "onClick={onShowRoute}","onClick={onRecenter}","data-apois-qa221-trip-hud",
   "data-apois-qa220-pin-digit-v1", "useApoisOperationalNotification",
   "ApoisExternalNavigation latitude={ride.origin_lat}",
   "ApoisExternalNavigation latitude={ride.destination_lat}",
   "refreshDue = !samePhase"]){
  if(!s.includes(required))throw Error("[FAIL] ExternalNav Motorista preserved feature "+required);
 }
 if(s.includes("tickNavigation(")||s.includes("qa222DistanceToRoute("))throw Error("[FAIL] ExternalNav obsolete guided navigation survived");
 writeFileSync(file,s,"utf8");
 console.log("[OK] Motorista: external navigator for pickup/destination, no old turn-by-turn voice, bounded ETA, status controls and native GPS intact");
}else{
 const mapFile=resolve(root,"src/components/CourierRouteMap.tsx");
 const routeFile=resolve(root,"src/routes/courier.tsx");
 let map=readFileSync(mapFile,"utf8"),app=readFileSync(routeFile,"utf8");
 if(map.includes("APOIS_PARTNER_EXTERNAL_NAV_UI_V1"))throw Error("[FAIL] ExternalNav Courier applied twice");
 for(const t of ["export function CourierRouteMap(","const openNavigation = () => {",
   "onClick={openNavigation}","APOIS_COURIER_MAPS_URL_NO_API_KEY_V1","goingToDelivery",
   "job.pickup_latitude","job.delivery_latitude","data-apois-courier-route-map"]){
  if(!map.includes(t))throw Error("[FAIL] ExternalNav Courier prerequisite "+t);
 }
 map='// APOIS_PARTNER_EXTERNAL_NAV_UI_V1\n'+
  'import { ApoisExternalNavigation } from "@/components/ApoisExternalNavigation";\n'+map;
 // Eliminate legacy Browser.open and its alternative window.open, replacing with
 // one real native Android Activity chooser. Keep operational map intact.
 const ms=map.indexOf("export function CourierRouteMap(");
 const ns=map.indexOf("  // APOIS_COURIER_MAPS_URL_NO_API_KEY_V1:",ms);
 const ne=ns<0?-1:map.indexOf("\n  if (!target) {",ns);
 if(ns<0||ne<=ns)throw Error("[FAIL] ExternalNav Courier old navigation helper boundaries");
 const oldHelper=map.slice(ns,ne);
 if(!oldHelper.includes("Browser.open({ url })")||!oldHelper.includes("openNavigation"))throw Error("[FAIL] ExternalNav old opening helper changed");
 map=map.slice(0,ns)+
  '  // The external navigator uses the real pickup/customer coordinates; no API key is required.\n'+
  map.slice(ne);
 // Replace only the one legacy CTA within active CourierRouteMap; header remains intact.
 const rs=map.indexOf("export function CourierRouteMap(");
 const nav=map.indexOf("onClick={openNavigation}",rs);
 const opening=nav<0?-1:map.lastIndexOf("<button",nav);
 const closing=nav<0?-1:map.indexOf("</button>",nav);
 if(opening<0||closing<=opening)throw Error("[FAIL] ExternalNav Courier old Rotas CTA boundary");
 map=map.slice(0,opening)+map.slice(closing+9);
 const stats=map.indexOf('<div className="grid grid-cols-2',rs);
 if(stats<0)throw Error("[FAIL] ExternalNav Courier route metrics panel missing");
 const component=[
  '      <div className="border-b border-[#E5E7EB] bg-white px-3 py-2">',
  '        <ApoisExternalNavigation latitude={target.lat} longitude={target.lng}',
  '          stage={goingToDelivery ? "até o cliente" : "até o estabelecimento"} />',
  '      </div>',
  ''
 ].join("\n");
 map=map.slice(0,stats)+component+"      "+map.slice(stats);
 // The native Browser import was only needed by the old openNavigation helper.
 map=once(map,'import { Browser } from "@capacitor/browser";\n',"","remove unused Browser dependency");
 if((map.match(/\bCapacitor\./g)||[]).length===0){
  map=map.replace('import { Capacitor } from "@capacitor/core";\n',"");
 }
 if((map.match(/<ExternalLink\b/g)||[]).length===0){
  map=map.replace('Crosshair, ExternalLink, MapPin','Crosshair, MapPin');
 }
 app='// APOIS_PARTNER_EXTERNAL_NAV_UI_V1: active delivery updates the existing Android notification.\n'+
   'import { useApoisOperationalNotification } from "@/components/ApoisExternalNavigation";\n'+app;
 app=once(app,
   '  const [activeJob, setActiveJob] = useState<any>(null);',
   '  const [activeJob, setActiveJob] = useState<any>(null);\n'+
   '  useApoisOperationalNotification("entregador", Boolean(activeJob));',
   "Courier location notification operation state");
 for(const t of ["ApoisExternalNavigation latitude={target.lat}",'stage={goingToDelivery ? "até o cliente" : "até o estabelecimento"}',
  "job.pickup_latitude","job.delivery_latitude","onMetrics={setMetrics}","update_courier_delivery_route_metrics",
  "useApoisOperationalNotification","onTransition={transitionDelivery}","onComplete={completeDelivery}"]){
   if(!(map+"\n"+app).includes(t))throw Error("[FAIL] ExternalNav Courier protected feature "+t);
 }
 if(map.includes("onClick={openNavigation}")||map.includes("Browser.open({ url })"))throw Error("[FAIL] ExternalNav courier still opens legacy in-app Browser");
 writeFileSync(mapFile,map,"utf8");
 writeFileSync(routeFile,app,"utf8");
 console.log("[OK] Entregador: shared external navigation for merchant/customer; existing GPS, collection, delivery, auth, payment and metrics untouched");
}
