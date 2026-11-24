import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CarFront, Check, ChevronDown, CircleAlert, Clock3, Crosshair,
  MapPin, Navigation, Phone, RefreshCw, Share2, ShieldCheck, Star, X
} from "lucide-react";
import PassengerMap from "@/components/map/PassengerMap";
import { googleMapsLoader } from "@/services/google/google-maps-loader";
import { supabase } from "@/integrations/supabase/client";
import type { ActiveRide } from "@/types/rides/active-ride";

// APOIS_TRIP_DESTINATION_PREMIUM_V1
// Only rendered for the backend-confirmed "em_viagem" status.
// No invented ETA, fare, route, driver photo, rating, or vehicle details.
type Point = { lat: number; lng: number; heading?: number };
type TripRoute = {
  points: Array<{lat:number;lng:number}>;
  distanceMeters: number;
  durationSeconds: number;
};
type TripProps = {
  ride: ActiveRide;
  isRefreshing: boolean;
  isRealtimeConnected: boolean;
  onBack: () => void;
  onRefresh: () => void;
};

function isPoint(value: Point | null | undefined): value is Point {
  return Boolean(value && Number.isFinite(value.lat) && Number.isFinite(value.lng) &&
    Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180);
}
function distanceMeters(a: Point, b: Point): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat)*rad;
  const dLng = (b.lng - a.lng)*rad;
  const x = Math.sin(dLat/2)**2 +
    Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dLng/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(x)));
}
function money(value: number): string {
  return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
}
function timeLabel(seconds: number): string {
  return String(Math.max(1,Math.ceil(seconds/60)))+" min";
}
function distanceLabel(meters: number): string {
  if (meters < 1000) return String(Math.max(10,Math.round(meters/10)*10))+" m restantes";
  return (meters/1000).toFixed(1).replace(".",",")+" km restantes";
}
function compactDestination(value: string): string {
  const clean=String(value||"Destino final").trim();
  const parts=clean.split(",").map(x=>x.trim()).filter(Boolean);
  const choice=parts[0] ?? clean;
  return choice.length>38 ? choice.slice(0,37)+"…" : choice;
}
function paymentName(value: string): string {
  const labels:Record<string,string>={
    cash:"Dinheiro",money:"Dinheiro",pix:"Pix",credit:"Cartão de crédito",
    credit_card:"Cartão de crédito",debit:"Cartão de débito",
    debit_card:"Cartão de débito",wallet:"Carteira APOIS",
    corporate:"Corporativo",
  };
  return labels[value?.toLowerCase()] || value || "A confirmar";
}

// A single directions request when the ride appears, then at most once every
// 90s if the driver actually moved >= 80m. Never geocode or poll on every render.
function useVerifiedRemainingRoute(ride: ActiveRide, driver: Point|null): TripRoute|null {
  const [route,setRoute]=useState<TripRoute|null>(null);
  const driverRef=useRef<Point|null>(driver);
  const lastSuccess=useRef<Point|null>(null);
  const lastAttempt=useRef(0);
  driverRef.current=driver;

  useEffect(()=>{
    let disposed=false;
    let busy=false;
    lastSuccess.current=null;
    lastAttempt.current=0;
    setRoute(null);

    async function refreshRoute(){
      if (disposed || busy || document.visibilityState!=="visible") return;
      const current=driverRef.current;
      const dest=ride.destination;
      if (!isPoint(current) || !isPoint(dest)) return;
      if (lastSuccess.current && distanceMeters(lastSuccess.current,current)<80) return;
      if (Date.now()-lastAttempt.current < 75_000) return;
      busy=true;
      lastAttempt.current=Date.now();
      try {
        await googleMapsLoader.importLibrary("routes");
        if (disposed) return;
        const maps=(window as any).google?.maps;
        if (!maps?.DirectionsService || !maps?.TravelMode?.DRIVING) return;
        const directions=new maps.DirectionsService();
        const result: any = await new Promise((resolve,reject)=>{
          directions.route({
            origin:{lat:current.lat,lng:current.lng},
            destination:{lat:dest.lat,lng:dest.lng},
            travelMode:maps.TravelMode.DRIVING,
          },(response:any,status:any)=>{
            if (status==="OK" && response?.routes?.length) resolve(response);
            else reject(new Error("route_unavailable"));
          });
        });
        if (disposed) return;
        const first=result.routes?.[0];
        const legs=first?.legs||[];
        const meters=legs.reduce((sum:number,l:any)=>sum+(Number(l.distance?.value)||0),0);
        const seconds=legs.reduce((sum:number,l:any)=>sum+(Number(l.duration?.value)||0),0);
        const points=(first?.overview_path||[]).map((point:any)=>({
          lat:typeof point.lat==="function"?point.lat():Number(point.lat),
          lng:typeof point.lng==="function"?point.lng():Number(point.lng),
        })).filter((point:Point)=>isPoint(point));
        if (meters>0 && seconds>0 && points.length>1){
          lastSuccess.current=current;
          setRoute({points,distanceMeters:meters,durationSeconds:seconds});
        }
      } catch {
        // Do not fabricate an ETA if the Maps Directions service fails.
      } finally {busy=false;}
    }
    void refreshRoute();
    const interval=window.setInterval(()=>{void refreshRoute();},90_000);
    return ()=>{disposed=true;window.clearInterval(interval);};
  },[ride.id,ride.destination.lat,ride.destination.lng]);
  return route;
}

function usePrivateDriverPhoto(rawPhoto:string|undefined,driverId:string|undefined){
  const [url,setUrl]=useState<string|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true;
    setUrl(null);setFailed(false);
    const raw=String(rawPhoto||"").trim();
    if (!raw) return ()=>{active=false;};
    if (/^https:\/\//i.test(raw)){
      setUrl(raw);
      return ()=>{active=false;};
    }
    if (raw.includes("..") || /^[a-z]+:\/\//i.test(raw)) {
      setFailed(true);
      return ()=>{active=false;};
    }
    void supabase.storage.from("profile-photos").createSignedUrl(raw,3600)
      .then(({data,error})=>{
        if (!active) return;
        if (error || !data?.signedUrl){setFailed(true);return;}
        setUrl(data.signedUrl);
      }).catch(()=>{if(active)setFailed(true);});
    return ()=>{active=false;};
  },[rawPhoto,driverId]);
  return {url,failed,onError:()=>{setFailed(true);setUrl(null);}};
}

const StableTripMap=React.memo(function StableTripMap({
  ride,driver,points
}:{
  ride:ActiveRide;driver:Point|null;points:Array<{lat:number;lng:number}>;
}){
  return <PassengerMap
    origin={ride.origin}
    destination={ride.destination}
    encodedPolyline={undefined}
    driverLocation={driver??undefined}
    isStatic={false}
    isTrip={true}
    focusPickup={false}
    approachMode={false}
    journeyRoutePoints={points}
  />;
},(a,b)=>
  a.ride.id===b.ride.id &&
  a.driver?.lat===b.driver?.lat &&
  a.driver?.lng===b.driver?.lng &&
  a.driver?.heading===b.driver?.heading &&
  a.ride.destination.lat===b.ride.destination.lat &&
  a.ride.destination.lng===b.ride.destination.lng &&
  a.points===b.points
);

export function ApoisTripInProgressPremium({
  ride,isRefreshing,isRealtimeConnected,onBack,onRefresh
}:TripProps){
  const driver=useMemo<Point|null>(()=>{
    const p:Point={lat:ride.driver_latitude as number,lng:ride.driver_longitude as number,
      ...(typeof ride.driver_heading==="number" ? {heading:ride.driver_heading} : {})};
    return isPoint(p)?p:null;
  },[ride.driver_latitude,ride.driver_longitude,ride.driver_heading]);
  const route=useVerifiedRemainingRoute(ride,driver);
  const points=useMemo(()=>route?.points||[],[route]);
  const photo=usePrivateDriverPhoto(ride.driver_photo,ride.driver_id);
  const [expanded,setExpanded]=useState(false);
  const [supportOpen,setSupportOpen]=useState(false);
  const [supportText,setSupportText]=useState("");
  const [copyMessage,setCopyMessage]=useState("");
  const driverName=String(ride.driver_name||"Motorista parceiro").trim();
  const vehicle=[ride.driver_vehicle_model,ride.driver_vehicle_color].filter(Boolean).join(" • ");
  const plate=String(ride.driver_vehicle_plate||"").toUpperCase().trim();
  const phone=String(ride.driver_phone||"").replace(/[^\d+]/g,"");
  const rating=typeof ride.driver_rating==="number" && Number.isFinite(ride.driver_rating)
    ? ride.driver_rating.toFixed(1).replace(".",","):null;

  const shareReport=async()=>{
    const text="APOIS Corridas — solicitação de suporte\nCorrida: "+ride.id+
      "\nRelato: "+(supportText.trim()||"Problema durante a viagem.");
    try{
      if (typeof navigator.share==="function"){
        await navigator.share({title:"Ajuda com corrida APOIS",text});
        setCopyMessage("Compartilhamento aberto.");
      } else if (navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(text);
        setCopyMessage("Relato copiado. Envie ao suporte da APOIS.");
      } else setCopyMessage("Não foi possível abrir o compartilhamento neste aparelho.");
    }catch{
      setCopyMessage("Compartilhamento não concluído. Tente novamente.");
    }
  };

  return (
    <main data-apois-trip-destination-premium-v1="true"
      className="relative flex h-full min-h-0 flex-col overflow-hidden bg-white text-[#131419]">
      <header className="app-safe-top app-safe-x z-30 flex shrink-0 items-center justify-between bg-white px-3 pb-2 pt-2 shadow-sm">
        <button type="button" onClick={onBack} aria-label="Voltar" className="app-pressable flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100">
          <ArrowLeft size={22}/>
        </button>
        <div aria-label="APOIS Corridas" className="text-center">
          <p className="text-[22px] font-black italic tracking-[-0.07em] leading-none"><span className="text-[#E51B23]">A</span>POIS</p>
          <p className="mt-1 text-[9px] font-black tracking-[0.32em] text-[#BF0924]">CORRIDAS</p>
        </div>
        <button type="button" aria-label="Atualizar acompanhamento" onClick={onRefresh} disabled={isRefreshing}
          className="app-pressable flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 disabled:opacity-50">
          <RefreshCw size={19} className={isRefreshing?"animate-spin":""}/>
        </button>
      </header>

      <section aria-label="Mapa da viagem em andamento" className="relative min-h-[220px] flex-[1_1_54%] overflow-hidden bg-[#E9E7E1]">
        <StableTripMap ride={ride} driver={driver} points={points}/>
        <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center px-3">
          <div className="flex min-w-[180px] max-w-[90%] items-center gap-3 rounded-[23px] border border-white/95 bg-white/95 px-4 py-3 shadow-[0_7px_30px_rgba(0,0,0,.16)]">
            <Navigation size={24} fill="#D50923" className="shrink-0 text-[#D50923]"/>
            <div className="min-w-0 border-l border-zinc-200 pl-3">
              <p className="text-[24px] font-black leading-none text-zinc-950">{route?timeLabel(route.durationSeconds):"—"}</p>
              <p className="mt-1 whitespace-nowrap text-[12px] font-semibold text-zinc-600">
                {route?distanceLabel(route.distanceMeters):driver?"Calculando trajeto...":"Aguardando localização..."}
              </p>
            </div>
          </div>
        </div>
        {!isRealtimeConnected && (
          <div role="status" className="pointer-events-none absolute left-3 top-[86px] z-20 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800">
            Reconectando localização
          </div>
        )}
        <button type="button" aria-label="Centralizar no motorista" onClick={()=>window.dispatchEvent(new Event("apois-trip-recenter"))}
          className="app-pressable absolute bottom-8 right-4 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white text-[#D50923] shadow-[0_5px_18px_rgba(0,0,0,.18)]">
          <Crosshair size={23}/>
        </button>
      </section>

      <section className="relative z-20 -mt-5 flex max-h-[56%] min-h-0 shrink-0 flex-col overflow-hidden rounded-t-[30px] bg-white shadow-[0_-6px_27px_rgba(0,0,0,.10)]">
        <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}
          aria-label={expanded?"Recolher detalhes da corrida":"Expandir detalhes da corrida"}
          className="app-pressable flex shrink-0 justify-center py-3">
          <span className="h-1.5 w-12 rounded-full bg-zinc-300"/>
        </button>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-4 [scrollbar-width:none]">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-2 text-[13px] font-extrabold text-[#B60922]">
              <CarFront size={19}/> A caminho do destino
            </span>
            <button type="button" onClick={()=>setExpanded(v=>!v)} aria-label={expanded?"Recolher":"Ver mais informações"} className="app-pressable flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
              <ChevronDown size={20} className={expanded?"rotate-180":""}/>
            </button>
          </div>
          <div className="flex items-start gap-3">
            <MapPin size={30} className="mt-0.5 shrink-0 text-[#D50923]"/>
            <div className="min-w-0 flex-1">
              <h1 className="line-clamp-2 text-[22px] font-black leading-tight">{compactDestination(ride.destination_name)}</h1>
              <p className="mt-1 text-[12px] font-medium text-zinc-500">Destino final</p>
            </div>
          </div>
          <div aria-label="Identificação do motorista" className="rounded-[23px] border border-zinc-200 bg-white p-3 shadow-[0_4px_22px_rgba(0,0,0,.05)]">
            <div className="flex items-center gap-3">
              <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[17px] bg-zinc-100">
                {photo.url ? (
                  <img src={photo.url} alt={"Foto do motorista "+driverName} onError={photo.onError}
                    decoding="async" className="h-full w-full object-cover"/>
                ):(
                  <div aria-label="Foto não disponível" className="flex h-full w-full items-center justify-center bg-red-50 text-[27px] font-black text-[#B60922]">{driverName.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-black">{driverName}</p>
                <p className="mt-0.5 truncate text-[12px] text-zinc-600">{vehicle||"Veículo confirmado"}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  {plate && <span className="rounded-lg bg-zinc-100 px-2 py-1 text-[12px] font-black tracking-wide">{plate}</span>}
                  {rating && <span className="flex items-center gap-1 text-[12px] font-bold text-zinc-600"><Star size={13} fill="#EAB308" className="text-amber-500"/>{rating}</span>}
                </div>
              </div>
              {phone && <a href={"tel:"+phone} aria-label="Ligar para o motorista" className="app-pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-50 text-[#D50923]"><Phone size={22}/></a>}
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-zinc-200 rounded-[22px] border border-zinc-200 px-3 py-3">
            <div className="min-w-0 pr-3">
              <p className="text-[11px] font-medium text-zinc-500">Valor estimado</p>
              <p className="mt-1 text-[19px] font-black">{money(ride.estimated_price)}</p>
            </div>
            <div className="min-w-0 pl-3">
              <p className="text-[11px] font-medium text-zinc-500">Pagamento</p>
              <p className="mt-1 truncate text-[18px] font-black">{paymentName(ride.payment_method)}</p>
            </div>
          </div>
          {expanded && (
            <div className="space-y-2 rounded-[18px] bg-zinc-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Detalhes da viagem</p>
              <p className="text-[12px] font-semibold text-zinc-700">Embarque: {ride.origin_name}</p>
              <p className="text-[12px] font-semibold text-zinc-700">Destino: {ride.destination_name}</p>
              {(ride.intermediates||[]).map((stop:any,i:number)=>(
                <p key={i} className="text-[12px] text-zinc-700">Parada {i+1}: {stop.address||stop.label||"Confirmada"}</p>
              ))}
              <p className="text-[10px] text-zinc-500">Código da corrida: {ride.id}</p>
            </div>
          )}
          <button type="button" onClick={()=>{setSupportOpen(true);setCopyMessage("");}}
            className="app-pressable flex min-h-12 w-full items-center justify-between rounded-[18px] border border-red-100 bg-red-50 px-4 py-3 text-[12px] font-extrabold text-[#A60920]">
            <span className="flex items-center gap-2"><CircleAlert size={20}/> Reportar problema com esta corrida</span>
            <Share2 size={17}/>
          </button>
        </div>
      </section>

      {supportOpen && (
        <div role="dialog" aria-modal="true" aria-label="Ajuda com esta corrida"
          className="absolute inset-0 z-[100] flex items-end justify-center bg-black/45 p-3">
          <div className="w-full max-w-[430px] space-y-3 rounded-[24px] bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-black">Problema com esta corrida</h2>
              <button type="button" onClick={()=>setSupportOpen(false)} aria-label="Fechar ajuda" className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"><X size={20}/></button>
            </div>
            <p className="text-[12px] leading-relaxed text-zinc-600">Descreva a situação. O botão abaixo abre as opções do Android para compartilhar o relato com o atendimento. Ele não envia uma ocorrência automaticamente.</p>
            <textarea rows={3} maxLength={1200} value={supportText} onChange={e=>setSupportText(e.target.value)}
              placeholder="Descreva o problema..." aria-label="Descrição do problema"
              className="w-full resize-none rounded-xl border border-zinc-200 bg-white p-3 text-[14px] text-zinc-900 outline-none focus:border-red-400"/>
            <button type="button" onClick={()=>void shareReport()} className="app-pressable min-h-12 w-full rounded-[15px] bg-[#E51B23] px-4 text-[14px] font-black text-white">
              Compartilhar relato e número da corrida
            </button>
            {copyMessage && <p role="status" className="text-center text-[12px] text-zinc-600">{copyMessage}</p>}
          </div>
        </div>
      )}
    </main>
  );
}
