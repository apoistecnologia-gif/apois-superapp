// QA290 + approved offer: only the disposable Motorista workspace.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||'.work/partner-motorista');
const path=resolve(root,'src/routes/motorista.app.tsx');
let s=readFileSync(path,'utf8');
function once(a,b,label){if(s.split(a).length!==2)throw Error('[FAIL] visible offer: '+label);s=s.replace(a,()=>b);}
function change(a,b,label){if(s.split(a).length!==2)throw Error('[FAIL] offer UI: '+label);s=s.replace(a,()=>b);}
if(s.includes('APOIS_VISIBLE_OFFER_REVALIDATION_V2'))throw Error('Duplicate offer patch');

// The same decision function is used by the app and the test cases below.
// null after a SUCCESSFUL RLS-scoped read means the offer is no longer visible,
// not proof that the passenger cancelled. Never infer cancellation from errors.
function classify(row,userId,driverId,accepting){
  if(row?.status==="cancelada_passageiro")return "passenger_cancelled";
  if(row?.status==="cancelada_motorista")return "no_longer_candidate";
  const owner=row?.accepted_driver_id ?? row?.driver_id ?? null;
  if(owner && owner!==driverId)return "accepted_by_other";
  if(accepting)return null;
  if(!row || row.status!=="procurar_motorista")return "no_longer_candidate";
  if(Array.isArray(row.rejected_driver_ids)&&row.rejected_driver_ids.includes(userId))return "driver_rejected";
  if(!Array.isArray(row.candidate_driver_ids)||!row.candidate_driver_ids.includes(userId))return "no_longer_candidate";
  return null;
}
const available={status:"procurar_motorista",candidate_driver_ids:["user"],rejected_driver_ids:[]};
assert.equal(classify(available,"user","driver",false),null);
assert.equal(classify({...available,status:"cancelada_passageiro"},"user","driver",true),"passenger_cancelled");
assert.equal(classify(null,"user","driver",false),"no_longer_candidate");
assert.equal(classify(null,"user","driver",true),null);
assert.equal(classify({...available,driver_id:"other"},"user","driver",false),"accepted_by_other");
assert.equal(classify({...available,candidate_driver_ids:[]},"user","driver",false),"no_longer_candidate");
assert.equal(classify({...available,rejected_driver_ids:["user"]},"user","driver",false),"driver_rejected");
const helper='// APOIS_VISIBLE_OFFER_REVALIDATION_V2\nconst classifyVisibleOffer: (row: {status:string;accepted_driver_id?:string|null;driver_id?:string|null;candidate_driver_ids?:unknown;rejected_driver_ids?:unknown}|null,userId:string,driverId:string|null,accepting:boolean) => RequestRemovalReason|null = '+classify.toString()+';\n\n';
once('function getRequestExpiresAtMs(ride: RideRow): number | null {',helper+'function getRequestExpiresAtMs(ride: RideRow): number | null {','decision');
once('  const incomingRef = useRef<RideRow | null>(null);','  const incomingRef = useRef<RideRow | null>(null);\n  const offerAcceptInFlightRef = useRef<string | null>(null);\n  const invalidatedOfferIdsRef = useRef<Set<string>>(new Set());\n  const [offerAcceptBusy,setOfferAcceptBusy] = useState(false);','accept state');
once('    setIncoming((current) => current?.id === ride.id ? null : current);\n    if (removeReason !== "expired") handledRidesRef.current.add(ride.id);','    if (incomingRef.current?.id === ride.id) incomingRef.current = null;\n    setIncoming((current) => current?.id === ride.id ? null : current);\n    setProfilePassengerId(current=>current===ride.id?null:current);\n    if (removeReason !== "expired") {\n      handledRidesRef.current.add(ride.id);\n      invalidatedOfferIdsRef.current.add(ride.id);\n    }','dismiss scope');
once('      setIncoming(r);\n      setCountdown(computeOfferCountdown(r));\n      if (navigator.vibrate)', '      const sameOffer = incomingRef.current?.id === r.id;\n      incomingRef.current = r;\n      setIncoming(r);\n      setCountdown(computeOfferCountdown(r));\n      if (!sameOffer && navigator.vibrate)','sync incoming ref');
once('      const terminalEvent = r.status === "finalizada" || r.status === "cancelada_passageiro" || r.status === "cancelada_motorista";','      const terminalEvent = r.status === "finalizada" || r.status === "cancelada_passageiro" || r.status === "cancelada_motorista";\n      if(terminalEvent && offerAcceptInFlightRef.current===r.id)invalidatedOfferIdsRef.current.add(r.id);','terminal during accept');
once('          const row = (p.new ?? p.old) as RideRow;','          if(p.eventType==="DELETE"){\n            const shown=incomingRef.current;\n            if(shown && (p.old as {id?:string})?.id===shown.id)removeIncomingRequest(shown,"no_longer_candidate");\n            return;\n          }\n          const row = (p.new ?? p.old) as RideRow;','deleted offer');
once('    const resyncDriverRides = async () => {','    let visibleOfferReadClosed=false;\n    let visibleOfferReadBusy=false;\n    // Only a currently displayed offer is polled; at most one request in flight.\n    const revalidateVisibleOffer=async()=>{\n      const shown=incomingRef.current;\n      if(!shown || visibleOfferReadClosed || visibleOfferReadBusy || !navigator.onLine || document.visibilityState!=="visible")return;\n      visibleOfferReadBusy=true;\n      try{\n        const {data,error}=await supabase.from("rides").select("*").eq("id",shown.id).maybeSingle();\n        if(error || visibleOfferReadClosed || incomingRef.current?.id!==shown.id)return;\n        const fresh=data as RideRow|null;\n        const owner=fresh ? ((fresh as any).accepted_driver_id ?? fresh.driver_id) : null;\n        if(fresh && owner===driverId && ["motorista_a_caminho","motorista_chegou","em_viagem"].includes(fresh.status)){\n          if(offerAcceptInFlightRef.current!==shown.id)applyActive(fresh);\n          return;\n        }\n        const reason=classifyVisibleOffer(fresh,userId,driverId,offerAcceptInFlightRef.current===shown.id);\n        if(!reason)return;\n        removeIncomingRequest(shown,reason);\n        if(reason==="passenger_cancelled")toast.info("O passageiro cancelou a solicitação.");\n        else if(reason==="accepted_by_other")toast.info("Corrida aceita por outro motorista");\n        else if(reason==="no_longer_candidate")toast.info("Esta oferta não está mais disponível.");\n      }catch(error){if(import.meta.env.DEV)console.warn("[APOIS] Não foi possível verificar a oferta",error);}\n      finally{visibleOfferReadBusy=false;}\n    };\n    const visibleOfferPoll=window.setInterval(()=>void revalidateVisibleOffer(),2000);\n    const resyncDriverRides = async () => {\n      void revalidateVisibleOffer();\n      // A push/resume may arrive after an assigned ride ceased to be ongoing.\n      const tracked=activeRef.current;\n      if(tracked){\n        const {data,error}=await supabase.from("rides").select("*").eq("id",tracked.id).maybeSingle();\n        if(!error && data && activeRef.current?.id===tracked.id && (data as RideRow).status!==tracked.status)applyActive(data as RideRow);\n      }','revalidate displayed offer');
once('      else setQueuedRide(null);','      else if(!queued.error) setQueuedRide(null);','queued read error');
once('      window.clearInterval(offerPoll);','      window.clearInterval(offerPoll);\n      visibleOfferReadClosed=true;\n      window.clearInterval(visibleOfferPoll);','cleanup');
once('    if (countdown <= 0) {\n      removeIncomingRequest(incoming, "expired");','    if (countdown <= 0) {\n      if(offerAcceptBusy)return;\n      removeIncomingRequest(incoming, "expired");','expiry during accept');
once('  }, [incoming, countdown, callReject, removeIncomingRequest]);','  }, [incoming, countdown, callReject, removeIncomingRequest,offerAcceptBusy]);','expiry dep');
once('    if (!offer) return;\n    try {\n      const r = await callAccept({ data: { rideId: offer.id } });','    if (!offer || offerAcceptInFlightRef.current || invalidatedOfferIdsRef.current.has(offer.id)) return;\n    offerAcceptInFlightRef.current=offer.id;\n    setOfferAcceptBusy(true);\n    try {\n      const r = await callAccept({ data: { rideId: offer.id } });\n      // An older acceptance response must not revive a confirmed cancelled ride.\n      if(invalidatedOfferIdsRef.current.has(offer.id))return;','accept guard');
once('      handledRidesRef.current.delete(offer.id);\n      // A rejected promise must never resurrect an expired or replaced offer.\n      setIncoming((current) => current?.id === offer.id ? offer : current);\n      setGpsMessage(e instanceof Error ? e.message : "Não foi possível aceitar a corrida. Tente novamente.");\n    }\n  }\n  async function handleReject() {','      // A failed acceptance cannot clear the tombstone of a cancelled offer.\n      if(incomingRef.current?.id===offer.id && !invalidatedOfferIdsRef.current.has(offer.id))toast.error(e instanceof Error ? e.message : "Não foi possível aceitar a corrida. Tente novamente.");\n    } finally {\n      if(offerAcceptInFlightRef.current===offer.id)offerAcceptInFlightRef.current=null;\n      setOfferAcceptBusy(false);\n    }\n  }\n  async function handleReject() {','failed accept');
once('    if (!offer) return;\n    removeIncomingRequest(offer, "driver_rejected");','    if (!offer || offerAcceptInFlightRef.current===offer.id) return;\n    removeIncomingRequest(offer, "driver_rejected");','reject during accept');
once('          ride={incoming}\n          passenger={passenger}','          key={incoming.id}\n          ride={incoming}\n          accepting={offerAcceptBusy}\n          passenger={passenger}','offer props');
once('  ride, passenger, countdown, driverPos, onAccept, onReject, onOpenProfile,\n}: {\n  ride: RideRow; passenger: Passenger | null; countdown: number;','  ride, passenger, countdown, driverPos, onAccept, onReject, onOpenProfile,accepting,\n}: {\n  ride: RideRow; passenger: Passenger | null; countdown: number; accepting:boolean;','offer signature');
// Replace presentation only inside the function. Keep computed values, voice,
// real passenger profile, addresses, swipe-to-accept and actual reject callback.
const begin=s.indexOf('function IncomingOffer({'),end=s.indexOf('function InfoCard({',begin);
if(begin<0||end<=begin)throw Error('Missing QA290 offer');
const old=s.slice(begin,end);
const render=old.indexOf('  return (\n    <div\n      data-apois-driver-offer-readable-v7');
if(render<0)throw Error('Missing offer render');
const jsx = `  return (
    <div data-apois-driver-offer-readable-v7 data-apois-driver-offer-qa195="true"
      data-apois-premium-screen="driver-offer" data-apois-qa290-compact-offer="true"
      data-apois-driver-offer-modern-v2
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/20"
      style={{paddingBottom:"max(8px,env(safe-area-inset-bottom))",paddingTop:"max(20px,env(safe-area-inset-top))"}}
      role="dialog" aria-modal="true" aria-label="Nova corrida disponível">
      <section className="flex min-h-0 w-full max-w-md flex-col overflow-hidden rounded-t-[24px] border border-[#E7E9ED] bg-white text-[#111827] shadow-xl"
        style={{maxHeight:"min(88dvh,640px)"}}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#F0F1F3] bg-white px-4 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <img src={APOIS_PARTNER_LOGO_DATA_URL} alt="" className="h-9 w-9 shrink-0 object-contain"/>
            <div><p className="text-[15px] font-extrabold leading-tight text-[#111827]">Nova corrida</p><p className="text-[11px] font-semibold text-[#BB071D]">APOIS Motorista</p></div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-[10px] text-[#626B76]">Responder</span>
            <CountdownRing seconds={countdown} pct={pct} />
          </div>
        </header>
        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F6F7F9] px-3 py-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-[#596474]">Valor previsto</p>
              <p className="text-[clamp(26px,7.8vw,36px)] font-black leading-tight tabular-nums tracking-tight text-[#111827]">
                {ride.estimated_price != null ? formatBRL(Number(ride.estimated_price)) : "—"}
              </p>
              <p className="text-[11px] font-semibold text-[#BB071D]">{score.label}</p>
            </div>
            <div className="shrink-0 text-right"><p className="text-[10px] text-[#596474]">Pagamento</p>
              <p className="mt-1 rounded-lg bg-white px-2 py-1 text-[13px] font-bold text-[#111827]">{paymentLabelFor(ride.payment_method)}</p>
            </div>
          </div>
          <div data-apois-qa290-offer-metrics className="mt-3 grid grid-cols-4 gap-1.5">
            <InfoCard icon={<Clock className="h-4 w-4"/>} value={pickupMin != null ? String(pickupMin)+" min" : "—"} label="Até coleta"/>
            <InfoCard icon={<MapPin className="h-4 w-4"/>} value={pickupKm != null ? pickupKm.toFixed(1)+" km" : "—"} label="Embarque"/>
            <InfoCard icon={<RouteIcon className="h-4 w-4"/>} value={tripKm != null ? tripKm.toFixed(1)+" km" : "—"} label="Corrida"/>
            <InfoCard icon={<CatIcon className="h-4 w-4"/>} value={catLabel} label="Categoria" compactValue/>
          </div>
          <button type="button" onClick={onOpenProfile} className="mt-3 flex min-h-[54px] w-full items-center gap-3 rounded-xl border border-[#E7E9ED] bg-white px-3 py-2 text-left" aria-label="Ver perfil e preferências do passageiro">
            <Avatar src={passenger?.avatar_url ?? (ride as {passenger_photo_url?:string|null}).passenger_photo_url ?? null} name={passenger?.name ? passengerFirstName(passenger.name):""} size={40}/>
            <div className="min-w-0 flex-1"><p className="truncate text-[14px] font-bold">{passengerFirstName(passenger?.name)}</p><p className="truncate text-[11px] text-[#596474]">{ratingText}</p></div>
            <span className="shrink-0 text-[11px] font-semibold text-[#BB071D]">Preferências</span><ChevronRight className="h-4 w-4 shrink-0 text-[#BB071D]"/>
          </button>
          <div data-apois-qa290-offer-routes className="mt-3 rounded-xl border border-[#E7E9ED] bg-white px-3 py-2">
            { [{label:"Embarque",name:ride.pickup_label||ride.origin_name},{label:"Destino",name:ride.destination_name}].map((item,i)=>
              <div key={item.label} className="flex items-start gap-3 py-1.5">
                <span className={i===0?"mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#D50923]":"mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm bg-[#111827]"}/>
                <div className="min-w-0 flex-1"><p className="text-[11px] text-[#596474]">{item.label}</p><p className="break-words text-[13px] font-semibold leading-snug">{item.name||"Endereço não identificado"}</p></div>
              </div>)}
          </div>
          <p className="mt-2 text-right text-[11px] text-[#596474]">Deslocamento total: {totalKm!=null?totalKm.toFixed(1)+" km":"—"}</p>
        </div>
        <footer data-apois-qa290-offer-actions className="shrink-0 border-t border-[#E7E9ED] bg-white px-4 py-3">
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <ApoisSlideAction label="Aceitar corrida" onConfirm={onAccept} disabled={accepting} busy={accepting}/>
            <button type="button" disabled={accepting} onClick={onReject} className="min-h-11 rounded-xl border border-[#D1D5DB] bg-white px-3 text-sm font-semibold text-[#475467] disabled:opacity-50">Recusar</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

`;
s=s.slice(0,begin)+old.slice(0,render)+jsx+s.slice(end);
writeFileSync(path,s,'utf8');
console.log('[OK] Visible offer V2: new branded UI, actual swipe and profile preserved, verified 2s offer fallback, RLS loss/error and late accept guards.');
