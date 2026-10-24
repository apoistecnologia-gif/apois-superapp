// APOIS_CLIENT_RIDE_HISTORY_V1
// Substitui o placeholder "Suas Corridas" por historico real de rides,
// limitado ao DOMAIN USER ID autenticado, somente leitura.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const workspace=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas');
const path=resolve(workspace,'src/routes/_authenticated.corridas.tsx');
const before=readFileSync(path,'utf8');

const page=String.raw`import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, ArrowDown, CalendarDays, ChevronDown, ChevronUp, Clock3, History, MapPin, RefreshCw, Route as RouteIcon, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import type { Database } from "@/integrations/supabase/types";

// APOIS_CLIENT_RIDE_HISTORY_V1: historico somente leitura, sem gerar/cancelar corridas.
export const Route = createFileRoute("/_authenticated/corridas")({ component: CorridasPage });
type RideHistoryRow = Pick<Database["public"]["Tables"]["rides"]["Row"],
  "id" | "status" | "created_at" | "completed_at" | "category" |
  "origin_name" | "destination_name" | "estimated_price" | "final_price" |
  "payment_method" | "driver_name" | "cancellation_fee" | "cancellation_reason" |
  "distance_km" | "duration_min">;
type HistoryFilter = "all" | "completed" | "cancelled";
type LoadingState = "loading" | "ready" | "failed";
const PAGE_SIZE=20;
const price=(value: number | null): string | null =>
  typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value)
    : null;
const dateTime=(value: string | null): string => {
  if(!value) return "Data indisponível";
  const d=new Date(value);
  if(!Number.isFinite(d.getTime()))return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(d);
};
const titles:Record<string,string>={
  agendada:"Agendada",
  procurar_motorista:"Buscando motorista",
  motorista_a_caminho:"Motorista a caminho",
  motorista_chegou:"Motorista chegou",
  em_viagem:"Em viagem",
  finalizada:"Concluída",
  cancelada_passageiro:"Cancelada pelo passageiro",
  cancelada_motorista:"Cancelada pelo motorista",
};
const filterOptions:Array<{id:HistoryFilter;label:string}>=[
  {id:"all",label:"Todas"},
  {id:"completed",label:"Concluídas"},
  {id:"cancelled",label:"Canceladas"},
];
function CorridasPage() {
  const { profile, authState }=useAuth();
  // public.rides.passenger_id = public.users.id, nao auth.users.id.
  const passengerId=profile?.id ?? null;
  const [filter,setFilter]=useState<HistoryFilter>("all");
  const [rides,setRides]=useState<RideHistoryRow[]>([]);
  const [state,setState]=useState<LoadingState>("loading");
  const [pageError,setPageError]=useState<string | null>(null);
  const [hasMore,setHasMore]=useState(false);
  const [isLoadingMore,setIsLoadingMore]=useState(false);
  const [expanded,setExpanded]=useState<string | null>(null);
  const requestRef=useRef(0);
  const loadedCountRef=useRef(0);
  const inFlightRef=useRef(false);

  const fetchHistory=useCallback(async (reset:boolean, selected:HistoryFilter) => {
    if(!passengerId){
      ++requestRef.current;
      loadedCountRef.current=0;
      setRides([]);
      setHasMore(false);
      setState("ready");
      return;
    }
    if(!reset && inFlightRef.current)return;
    const seq=++requestRef.current;
    inFlightRef.current=true;
    if(reset){
      loadedCountRef.current=0;
      setRides([]);
      setExpanded(null);
      setState("loading");
      setPageError(null);
      setHasMore(false);
    }else{
      setIsLoadingMore(true);
      setPageError(null);
    }
    try{
      const start=reset?0:loadedCountRef.current;
      let query=supabase.from("rides")
        .select("id,status,created_at,completed_at,category,origin_name,destination_name,estimated_price,final_price,payment_method,driver_name,cancellation_fee,cancellation_reason,distance_km,duration_min")
        .eq("passenger_id",passengerId);
      if(selected==="completed")query=query.eq("status","finalizada");
      if(selected==="cancelled")query=query.in("status",["cancelada_passageiro","cancelada_motorista"]);
      // Os filtros devem ser aplicados antes de order/range (PostgREST).
      const {data,error}=await query.order("created_at",{ascending:false})
        .range(start,start+PAGE_SIZE-1);
      if(seq!==requestRef.current)return;
      if(error)throw error;
      const items=(data??[]) as RideHistoryRow[];
      loadedCountRef.current=start+items.length;
      setRides(old=>reset ? items : [...old,...items.filter(row=>!old.some(existing=>existing.id===row.id))]);
      setHasMore(items.length===PAGE_SIZE);
      setState("ready");
    }catch(err){
      if(seq!==requestRef.current)return;
      console.warn("[APOIS Ride History] Failed to read own rides",err instanceof Error?err.message:"unknown");
      setPageError("Não foi possível consultar suas corridas. Verifique a conexão e tente novamente.");
      setState(reset?"failed":"ready");
    }finally{
      if(seq===requestRef.current){
        inFlightRef.current=false;
        setIsLoadingMore(false);
      }
    }
  },[passengerId]);

  useEffect(()=>{
    inFlightRef.current=false;
    void fetchHistory(true,filter);
    return ()=>{ ++requestRef.current; inFlightRef.current=false; };
  },[fetchHistory,filter]);

  const selectFilter=(next:HistoryFilter)=>{
    if(next===filter)return;
    setFilter(next);
  };
  const isWaitingForProfile=authState==="initializing"||authState==="loading_profile";
  const emptyMessage=filter==="completed"?"Você ainda não possui corridas concluídas.":filter==="cancelled"?
    "Nenhuma corrida cancelada encontrada.":"Quando você solicitar corridas, elas aparecerão aqui.";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#F7F7F8] text-[#111827]">
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-8 pt-[max(22px,env(safe-area-inset-top))]">
        <header className="mb-5 flex items-start justify-between gap-3 px-1">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#D71920]">APOIS Cliente</p>
            <h1 className="mt-1 text-[29px] font-black tracking-tight">Suas Corridas</h1>
            <p className="mt-1 text-sm text-[#636B77]">Acompanhe seu histórico de viagens.</p>
          </div>
          <button type="button" aria-label="Atualizar histórico de corridas" onClick={()=>void fetchHistory(true,filter)}
            disabled={state==="loading" || isLoadingMore || isWaitingForProfile}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[#E1E4E8] bg-white text-[#D71920] shadow-sm disabled:opacity-50">
            <RefreshCw size={19} className={state==="loading"?"animate-spin":""}/>
          </button>
        </header>
        <nav aria-label="Filtrar histórico de corridas" className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {filterOptions.map(option=>(
            <button key={option.id} type="button" onClick={()=>selectFilter(option.id)}
              aria-pressed={filter===option.id}
              className={filter===option.id
                ?"min-h-10 shrink-0 rounded-full bg-[#E51B23] px-5 text-sm font-extrabold text-white shadow-sm"
                :"min-h-10 shrink-0 rounded-full border border-[#E2E4E8] bg-white px-5 text-sm font-bold text-[#525B69]"}>
              {option.label}
            </button>
          ))}
        </nav>
        {isWaitingForProfile || state==="loading" ? (
          <div role="status" aria-label="Carregando corridas" className="space-y-3">
            {[1,2,3].map(n=><div key={n} className="h-40 animate-pulse rounded-[22px] border border-[#ECEEF1] bg-white"/>)}
          </div>
        ):(!passengerId || state==="failed")?(
          <div role="alert" className="rounded-[24px] border border-[#F1D2D5] bg-white p-6 text-center shadow-sm">
            <AlertCircle className="mx-auto text-[#C9141B]" size={30}/>
            <h2 className="mt-3 text-lg font-black">Não foi possível consultar o histórico</h2>
            <p className="mt-2 text-sm text-[#636B77]">{!passengerId?"Seu perfil não está disponível. Entre novamente ou atualize sua sessão.":pageError}</p>
            <button type="button" onClick={()=>void fetchHistory(true,filter)}
              className="mt-4 min-h-11 rounded-xl bg-[#E51B23] px-5 text-sm font-black text-white">Tentar novamente</button>
          </div>
        ):rides.length===0?(
          <div className="rounded-[24px] border border-[#E2E4E8] bg-white px-5 py-9 text-center shadow-sm">
            <History className="mx-auto text-[#E51B23]" size={38}/>
            <h2 className="mt-4 text-lg font-black">Nenhuma corrida encontrada</h2>
            <p className="mx-auto mt-2 max-w-[270px] text-sm leading-relaxed text-[#626B78]">{emptyMessage}</p>
          </div>
        ):(
          <div className="space-y-3" aria-label="Lista de corridas">
            {rides.map(ride=>{
              const isCancelled=ride.status==="cancelada_passageiro"||ride.status==="cancelada_motorista";
              const isDone=ride.status==="finalizada";
              const open=expanded===ride.id;
              const amount=price(ride.final_price??ride.estimated_price);
              return (
                <article key={ride.id} className="overflow-hidden rounded-[23px] border border-[#E2E4E8] bg-white p-4 shadow-[0_4px_14px_rgba(0,0,0,.035)]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={"inline-flex max-w-full rounded-full px-3 py-1 text-[11px] font-extrabold "+(isDone?"bg-[#ECFDF3] text-[#18794E]":isCancelled?"bg-[#FFF1F2] text-[#B91C1C]":"bg-[#FEF3C7] text-[#925B0D]")}>
                        {titles[ride.status]??"Situação indisponível"}
                      </span>
                      <p className="mt-2 flex items-center gap-1 text-xs text-[#68707C]"><CalendarDays size={13}/>{dateTime(ride.created_at)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[15px] font-black tabular-nums text-[#111827]">{amount??"Valor indisponível"}</p>
                      <p className="mt-1 text-xs font-medium capitalize text-[#68707C]">{ride.category}</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-3 border-l-2 border-[#F3C8CB] pl-4">
                    <div className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#3069C5]"/>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#87909B]">Partida</p>
                      <p className="mt-0.5 break-words text-sm font-bold text-[#252B36]">{ride.origin_name||"Local não informado"}</p>
                    </div>
                    <div className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#E51B23]"/>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#87909B]">Destino</p>
                      <p className="mt-0.5 break-words text-sm font-bold text-[#252B36]">{ride.destination_name||"Local não informado"}</p>
                    </div>
                  </div>
                  <button type="button" onClick={()=>setExpanded(current=>current===ride.id?null:ride.id)}
                    aria-expanded={open} aria-label={(open?"Ocultar":"Ver")+" detalhes da corrida"}
                    className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#F2D1D3] bg-[#FFF7F7] px-3 text-sm font-extrabold text-[#C9141B]">
                    {open?"Ocultar detalhes":"Ver detalhes"} {open?<ChevronUp size={17}/>:<ChevronDown size={17}/>}
                  </button>
                  {open?(
                    <div className="mt-3 space-y-2 rounded-xl bg-[#F7F7F8] p-4 text-sm text-[#4B5563]">
                      <p className="flex items-start gap-2"><Wallet size={17} className="mt-0.5 shrink-0"/><span><strong>Pagamento:</strong> {ride.payment_method||"Não informado"}</span></p>
                      {ride.driver_name?<p className="flex items-start gap-2"><MapPin size={17} className="mt-0.5 shrink-0"/><span><strong>Motorista:</strong> {ride.driver_name}</span></p>:null}
                      {ride.distance_km!==null?<p className="flex items-start gap-2"><RouteIcon size={17} className="mt-0.5 shrink-0"/><span><strong>Distância registrada:</strong> {ride.distance_km.toLocaleString("pt-BR",{maximumFractionDigits:2})} km</span></p>:null}
                      {ride.duration_min!==null?<p className="flex items-start gap-2"><Clock3 size={17} className="mt-0.5 shrink-0"/><span><strong>Duração registrada:</strong> {ride.duration_min} min</span></p>:null}
                      {ride.completed_at?<p><strong>Finalização:</strong> {dateTime(ride.completed_at)}</p>:null}
                      {isCancelled && ride.cancellation_reason?<p className="break-words"><strong>Motivo informado:</strong> {ride.cancellation_reason}</p>:null}
                      {isCancelled && typeof ride.cancellation_fee==="number" && ride.cancellation_fee>0?
                        <p className="font-semibold text-[#B91C1C]">Taxa registrada: {price(ride.cancellation_fee)}</p>:null}
                      <p className="pt-1 text-[11px] text-[#7F8792]">ID: {ride.id.slice(0,8)}</p>
                    </div>
                  ):null}
                </article>
              );
            })}
            {pageError?<p role="alert" className="rounded-xl bg-[#FFF1F2] p-3 text-sm text-[#A91B24]">{pageError}</p>:null}
            {hasMore?<button type="button" disabled={isLoadingMore} onClick={()=>void fetchHistory(false,filter)}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-[#E2E4E8] bg-white text-sm font-extrabold text-[#D71920] disabled:opacity-50">
              {isLoadingMore?<RefreshCw size={18} className="animate-spin"/>:<ArrowDown size={18}/>}
              {isLoadingMore?"Carregando corridas...":"Carregar mais corridas"}
            </button>:null}
          </div>
        )}
      </main>
    </div>
  );
}
`;
if(!before.includes('APOIS_CLIENT_RIDE_HISTORY_V1')){
  if(!before.includes('createFileRoute("/_authenticated/corridas")') ||
     !before.includes('Suas Corridas') || before.includes('supabase.from("rides")')){
     throw new Error('[FAIL] Corridas: placeholder original mudou; substituição interrompida');
  }
  writeFileSync(path,page,'utf8');
}
const actual=readFileSync(path,'utf8');
for(const marker of [
  'APOIS_CLIENT_RIDE_HISTORY_V1','profile?.id ?? null','supabase.from("rides")',
  '.eq("passenger_id",passengerId)','status","finalizada"',
  '.in("status",["cancelada_passageiro","cancelada_motorista"])',
  '.range(start,start+PAGE_SIZE-1)','Nenhuma corrida encontrada',
  'aria-label="Lista de corridas"','Ver detalhes',
]){
  if(!actual.includes(marker))throw Error('[FAIL] Histórico do Cliente incompleto: '+marker);
}
console.log('[OK] APOIS_CLIENT_RIDE_HISTORY_V1: histórico paginado, próprio passageiro, somente leitura.');
