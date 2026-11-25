// APOIS_DRIVER_RIDE_VIDEO_AUDIT_V1 — QA290 disposable workspace only.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import assert from "node:assert/strict";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const path=resolve(root,"src/routes/motorista.app.tsx");
let s=readFileSync(path,"utf8");
function once(a,b,label){if(s.split(a).length!==2)throw Error("[FAIL] video audit: "+label);s=s.replace(a,()=>b);}
if(s.includes("APOIS_DRIVER_RIDE_VIDEO_AUDIT_V1"))throw Error("duplicate video audit");
once('  const [qa236PinOpen,setQa236PinOpen]=useState(false);','  // APOIS_DRIVER_RIDE_VIDEO_AUDIT_V1: PIN belongs to the current ride, not to its GPS phase.\n  const [qa236PinRideId,setQa236PinRideId]=useState<string|null>(null);\n  const qa236PinOpen=Boolean(active && qa236PinRideId===active.id);','PIN scope');
once('<ApoisPickupPin onClose={()=>setQa236PinOpen(false)}','<ApoisPickupPin key={active.id} onClose={()=>setQa236PinRideId(null)}','PIN close');
once('          setQa236PinOpen(false);','          setQa236PinRideId(null);','PIN success');
once('active && active.status === "motorista_a_caminho" && (\n        <PickupNavOverlay','active && ["motorista_a_caminho","motorista_chegou"].includes(active.status) && (\n        <PickupNavOverlay','arrived still has visible controls');
once('          onStartPin={()=>setQa236PinOpen(true)}','          onStartPin={()=>setQa236PinRideId(active.id)}','PIN open');
once('active && active.status !== "motorista_a_caminho" && active.status !== "em_viagem" && (() => {','active && !["motorista_a_caminho","motorista_chegou","em_viagem"].includes(active.status) && (() => {','no hidden arrived panel');
const profile='onOpenProfile={() => active.passenger_id && setProfilePassengerId(active.passenger_id)}';
assert.equal(s.split(profile).length-1,3);
s=s.replaceAll(profile,'onOpenProfile={() => setProfilePassengerId(active.id)}');
once('ApoisExternalNavigation, ApoisQuickMapButton, useApoisOperationalNotification','ApoisExternalNavigation, useApoisOperationalNotification','remove duplicate shortcut import');
once('      {/* QA239: return to external Google Maps/Waze, never internal routing. */}\n      {active && ["motorista_a_caminho","motorista_chegou","em_viagem"].includes(active.status) && (\n        <ApoisQuickMapButton latitude={active.status==="em_viagem"?active.destination_lat:active.origin_lat}\n          longitude={active.status==="em_viagem"?active.destination_lng:active.origin_lng} />\n      )}','      {/* One external navigation action in the operational footer; native return bubble remains available. */}','duplicate navigation shortcut');
once('text-[#C9141B]">Indo ao passageiro</p>','text-[#C9141B]">{ride.status==="motorista_chegou"?"Aguardando passageiro":"Indo ao passageiro"}</p>','arrived heading');
once('text-[#475467]">Siga para o embarque</span>','text-[#475467]">{ride.status==="motorista_chegou"?"Solicite o PIN":"Siga para o embarque"}</span>','arrived guidance');
once('setIncoming((current) => current?.id === offer.id ? null : current);\n      const accepted = r as RideRow;','setIncoming((current) => current?.id === offer.id ? null : current);\n      if(incomingRef.current?.id===offer.id)incomingRef.current=null;\n      setProfilePassengerId(current=>current===offer.id?null:current);\n      const accepted = r as RideRow;','accept clears offer refs');
once('        setActive(accepted);\n        setApoisExternalNavigationOwnsVoice(true);','        activeRef.current=accepted;\n        setActive(accepted);\n        setApoisExternalNavigationOwnsVoice(true);','confirmed acceptance ref');
once('          await launchApoisNavigationAfterRideStart(accepted.origin_lat, accepted.origin_lng);','          if(activeRef.current?.id===accepted.id && activeRef.current.status==="motorista_a_caminho")await launchApoisNavigationAfterRideStart(accepted.origin_lat, accepted.origin_lng);','no stale navigation after cancel');
// Explicit confirmation when far away or GPS unknown; not a backend geofence.
once('    if (busy) return;\n    setBusy(true);\n    try {\n      await onComplete();','    if (busy) return;\n    if(legKm===null || legKm>0.5){\n      const warning=legKm===null?"Não foi possível confirmar a proximidade do destino pelo GPS.":("O GPS indica "+qa242FormatDistance(legKm)+" até o destino.");\n      if(!window.confirm(warning+" Confirme somente se a viagem realmente terminou. Deseja finalizar a corrida?"))return;\n    }\n    setBusy(true);\n    try {\n      await onComplete();','far finish confirmation');
once('            // Não dependa do eco do Realtime para sair da corrida finalizada.\n            setActive(null);\n            setPolyline([]);\n            \n            setEtaSeconds(null);\n            setLegKm(null);\n            resetSpokenCache();','            // Do not clear a different ride when a delayed completion response arrives.\n            if(activeRef.current && activeRef.current.id!==active.id)return;\n            activeRef.current=null;\n            setActive(previous=>previous?.id===active.id?null:previous);\n            clearDriverRouteVisuals();\n            setProfilePassengerId(current=>current===active.id?null:current);\n            void setApoisOperationalNotification("motorista",false);\n            resetSpokenCache();','completion state');
once('            resetSpokenCache();\n            void speak("Corrida finalizada.", { interrupt: true });\n          }}','          }}','duplicate completion speech');
function elapsed(start,end){
  if(!start||!end)return null;
  const delta=Date.parse(end)-Date.parse(start);
  return Number.isFinite(delta)&&delta>=0 ? Math.floor(delta/1000):null;
}
assert.equal(elapsed("2026-11-24T22:00:00Z","2026-11-24T22:00:35Z"),35);
assert.equal(elapsed(null,"2026-11-24T22:00:35Z"),null);
assert.equal(elapsed("2026-11-24T22:01:00Z","2026-11-24T22:00:35Z"),null);
once('function RatingScreen({','const videoAuditElapsed: (start:string|null,end:string|null)=>number|null = '+elapsed.toString()+';\n\nfunction RatingScreen({','elapsed helper');
const duration=s.split("\n").filter(l=>l.startsWith('  const durationLabel = ride.duration_min ?'));
assert.equal(duration.length,1);
once(duration[0],'  const elapsedSeconds=videoAuditElapsed(ride.started_at,ride.completed_at);\n  const durationLabel=elapsedSeconds===null?"—":elapsedSeconds<60?elapsedSeconds+" s":Math.floor(elapsedSeconds/60)+" min";','real time');
once('label="Distância" value={distanceLabel}','label="Distância prevista" value={distanceLabel}','truthful distance');
once('label="Duração" value={durationLabel}','label="Tempo da viagem" value={durationLabel}','truthful elapsed');
once('O passageiro chegou com segurança.','Finalização registrada no sistema.','do not infer safety');
const ratingStart=s.indexOf('function RatingScreen({'),ratingEnd=s.indexOf('function SummaryRow(',ratingStart);
if(ratingStart<0||ratingEnd<=ratingStart)throw Error("rating boundary");
let rating=s.slice(ratingStart,ratingEnd);
rating=rating.replace('data-apois-driver-rating-readable-v7','data-apois-driver-rating-readable-v7 data-apois-rating-compact-video-v1')
 .replace('bg-black/45 animate-in fade-in duration-300','bg-black/35')
 .replace('style={{ backdropFilter: "blur(10px) saturate(140%)" }}','')
 .replace('if (e.target === e.currentTarget && !submitting) {\n          (submitted ? onDismiss : onSkip)();\n        }','// Keep evaluation open until an explicit action.\n        if (e.target === e.currentTarget) return;')
 .replace('px-5 pt-5 pb-[max(52px,env(safe-area-inset-bottom))]','px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]')
 .replaceAll(' animate-sheet-in','').replaceAll(' animate-in fade-in zoom-in-95 duration-400','').replaceAll(' animate-in fade-in slide-in-from-bottom-2 duration-500','')
 .replace('mx-auto -mt-1 mb-5 h-1.5 w-11','mx-auto mb-2 h-1 w-9')
 .replace(/<span\s+className="absolute inset-0 rounded-full animate-ping bg-primary\/30"\s+style=\{\{ animationDuration: "1600ms" \}\}\s*\/>/,'')
 .replace('h-16 w-16 items-center','h-11 w-11 items-center').replace(' animate-in zoom-in-50 duration-500','')
 .replace('h-11 w-11 text-primary-foreground animate-in fade-in zoom-in-75 duration-700','h-7 w-7 text-primary-foreground')
 .replace('mt-4 text-[26px]','mt-2 text-[22px]').replaceAll('mt-5 rounded-[24px] bg-[#F8FAFC] p-5','mt-3 rounded-2xl bg-[#F8FAFC] p-3').replaceAll('text-[36px]','text-[30px]')
 .replaceAll('rounded-[20px] bg-[#F8FAFC] p-3.5','rounded-xl bg-[#F8FAFC] p-3').replace('rounded-[20px] bg-[#F8FAFC] p-4','rounded-xl bg-[#F8FAFC] p-3')
 .replace('h-11 w-11 transition','h-7 w-7 transition')
 .replace('fill-amber-400 text-amber-400','fill-[#D50923] text-[#D50923]').replace('rows={2}','rows={1}');
if(rating.includes('animate-ping')||!rating.includes('onClick={onSkip}')||!rating.includes('onClick={onSubmit}'))throw Error("rating contract");
s=s.slice(0,ratingStart)+rating+s.slice(ratingEnd);
once('  const [countdown, setCountdown] = useState(RIDE_OFFER_TIMEOUT_SECONDS);','  const [countdown, setCountdown] = useState(RIDE_OFFER_TIMEOUT_SECONDS);\n  const localOfferDeadline=useRef<{id:string;deadline:number}|null>(null);\n  const shownCountdown=useCallback((ride:RideRow)=>{\n    const serverDeadline=getRequestExpiresAtMs(ride);\n    if(serverDeadline!==null)return Math.max(0,Math.min(RIDE_OFFER_TIMEOUT_SECONDS,Math.ceil((serverDeadline-Date.now())/1000)));\n    if(localOfferDeadline.current?.id!==ride.id)localOfferDeadline.current={id:ride.id,deadline:Date.now()+RIDE_OFFER_TIMEOUT_SECONDS*1000};\n    return Math.max(0,Math.ceil((localOfferDeadline.current.deadline-Date.now())/1000));\n  },[]);','local fallback');
once('      setCountdown(computeOfferCountdown(r));','      setCountdown(shownCountdown(r));','display clock');
once('setCountdown(computeOfferCountdown(incoming))','setCountdown(shownCountdown(incoming))','tick actual countdown');
once('[incoming, countdown, callReject, removeIncomingRequest,offerAcceptBusy]','[incoming, countdown, callReject, removeIncomingRequest,offerAcceptBusy,shownCountdown]','countdown dependencies');
assert.ok(s.includes('APOIS_QA239_EXTERNAL_ROUTES_ONLY_V1'));
assert.ok(s.includes('await callStart({data:{rideId:ride.id,safety_code:code}})'));
assert.ok(!s.includes('<ApoisQuickMapButton'));
writeFileSync(path,s);
const pinPath=resolve(root,"src/components/ApoisPickupPin.tsx");
let pin=readFileSync(pinPath,"utf8");
if(!pin.includes('placeholder="0000"')||!pin.includes('onSubmit(pin)'))throw Error("PIN component contract");
pin=pin.replace('placeholder="0000"','placeholder="••••"').replace('className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl"','className="max-h-[100dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[22px] bg-white p-4 shadow-xl"').replace('h-16 w-full rounded-2xl border-2','h-14 w-full rounded-xl border-2').replace('text-[32px]','text-[26px]');
writeFileSync(pinPath,pin);
console.log("[OK] Video audit: arrived PIN, single navigator, ride profile scope, actual elapsed, compact rating and guarded completion; no internal routes.");
