// APOIS_PARTNER_QA241_OFFER_PASSENGER_PROFILE_V1
// The production database has no get_passenger_public_profile RPC.
// Use the EXISTING ride-scoped, authenticated offer RPC and the data already
// displayed on the same offer. Never query unrelated users/contacts.
import { useEffect,useState } from "react";
import { Star,UserRound,Info,RefreshCcw,ShieldCheck } from "lucide-react";
import { Dialog,DialogContent,DialogHeader,DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/Avatar";
import { supabase } from "@/integrations/supabase/client";

type PublicOffer={name:string|null;avatar_url:string|null;average_rating:number|null;total_ratings:number|null};
const EMPTY:PublicOffer={name:null,avatar_url:null,average_rating:null,total_ratings:null};
type Phase="loading"|"ready"|"partial"|"unavailable";

function normalize(input:unknown):Partial<PublicOffer>{
  if(!input||typeof input!=="object")return {};
  const source=input as Record<string,unknown>;
  const name=typeof source.name==="string"&&source.name.trim()?source.name.trim():null;
  const avatar_url=typeof source.avatar_url==="string"&&/^https:\/\//.test(source.avatar_url)?source.avatar_url:null;
  const average_rating=source.average_rating==null?null:Number(source.average_rating);
  const total_ratings=source.total_ratings==null?null:Number(source.total_ratings);
  return {
    name,avatar_url,
    average_rating:average_rating!=null&&Number.isFinite(average_rating)?average_rating:null,
    total_ratings:total_ratings!=null&&Number.isFinite(total_ratings)?Math.max(0,total_ratings):null,
  };
}
export function ApoisDriverOfferPassengerProfile({
  open,onOpenChange,rideId,initial,
}:{
  open:boolean;onOpenChange:(open:boolean)=>void;rideId:string|null;
  initial:PublicOffer|null;
}){
  const [phase,setPhase]=useState<Phase>("loading");
  const [remote,setRemote]=useState<Partial<PublicOffer>>({});
  const [retry,setRetry]=useState(0);
  useEffect(()=>{
    if(!open||!rideId){setPhase("unavailable");setRemote({});return;}
    let alive=true;
    setRemote({});
    setPhase("loading");
    const hasOffer=Boolean(initial?.name||initial?.avatar_url||initial?.total_ratings);
    // Never leave a permanent animated skeleton on slow/offline Supabase.
    const deadline=window.setTimeout(()=>{
      if(alive)setPhase(hasOffer?"partial":"unavailable");
    },6500);
    void (supabase as any).rpc("apois_driver_offer_passenger",{p_ride_id:rideId})
      .then(({data,error}:{data:unknown;error:{message:string}|null})=>{
        if(!alive)return;
        if(error){setPhase(hasOffer?"partial":"unavailable");return;}
        const rows=Array.isArray(data)?data:(data&&typeof data==="object"?[data]:[]);
        const record=rows.length?normalize(rows[0]):{};
        if(Object.values(record).some(value=>value!=null)){
          setRemote(record);setPhase("ready");
        }else setPhase(hasOffer?"partial":"unavailable");
      })
      .catch(()=>{
        if(alive)setPhase(hasOffer?"partial":"unavailable");
      })
      .finally(()=>window.clearTimeout(deadline));
    return()=>{alive=false;window.clearTimeout(deadline);};
  },[open,rideId,retry]);
  const source:PublicOffer={...EMPTY,...normalize(initial),...Object.fromEntries(
    Object.entries(remote).filter(([,value])=>value!=null),
  )};
  const rating=source.average_rating;
  const ratings=source.total_ratings??0;
  const showRating=ratings>0&&rating!=null&&Number.isFinite(rating);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[min(90dvh,720px)] w-[calc(100vw-28px)] max-w-[410px] overflow-y-auto rounded-[26px] border border-[#E9D9DC] bg-white p-5 text-[#111827] shadow-[0_24px_75px_rgba(0,0,0,.24)]">
      <DialogHeader>
        <DialogTitle className="text-center text-[18px] font-black tracking-[-.025em] text-[#16181E]">Perfil do passageiro</DialogTitle>
      </DialogHeader>
      {phase==="loading"&&!initial?.name ? (
        <div role="status" aria-live="polite" className="space-y-4 py-3">
          <p className="text-center text-xs font-medium text-[#697180]">Consultando informações públicas da oferta…</p>
          <div className="mx-auto h-24 w-24 animate-pulse rounded-full bg-[#ECEFF2]"/>
          <div className="mx-auto h-5 w-40 animate-pulse rounded bg-[#ECEFF2]"/>
          <div className="h-24 animate-pulse rounded-2xl bg-[#F0F1F4]"/>
        </div>
      ) : phase==="unavailable" ? (
        <div className="flex flex-col items-center gap-3 py-5 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-3xl bg-[#FFF0F1] text-[#C91429]"><UserRound className="h-9 w-9"/></div>
          <p className="text-[15px] font-extrabold">Dados temporariamente indisponíveis</p>
          <p className="text-[12px] leading-5 text-[#64748B]">A consulta pública desta oferta não respondeu. Nenhum dado pessoal adicional será exibido.</p>
          <button type="button" onClick={()=>setRetry(x=>x+1)}
            className="flex min-h-11 items-center gap-2 rounded-xl bg-[#E51B23] px-4 text-[12px] font-extrabold text-white"><RefreshCcw className="h-4 w-4"/>Tentar novamente</button>
        </div>
      ) : (
        <div className="space-y-4 pb-2">
          <div className="flex flex-col items-center rounded-[22px] border border-[#ECEFF3] bg-[#FAFAFB] px-4 py-5 text-center">
            <div className="rounded-full border-4 border-white shadow-[0_10px_25px_rgba(0,0,0,.1)]">
              <Avatar src={source.avatar_url} name={source.name??""} size={90}/>
            </div>
            <p className="mt-3 text-[19px] font-black text-[#171A21]">{source.name||"Passageiro APOIS"}</p>
            <div className="mt-2 flex items-center gap-1.5 rounded-full bg-[#FFF1F2] px-3 py-1.5 text-[12px] font-bold text-[#A91A27]">
              <Star className="h-4 w-4 fill-[#E4A100] text-[#E4A100]"/>
              {showRating?rating!.toFixed(1)+" · "+ratings+" avaliações":"Ainda sem avaliação disponível"}
            </div>
          </div>
          {phase==="partial"?
            <p role="status" className="flex items-start gap-2 rounded-2xl border border-[#F0D5DA] bg-[#FFF8F8] p-3 text-[11px] font-semibold leading-5 text-[#8D2936]">
              <Info className="mt-0.5 h-4 w-4 shrink-0"/>
              Exibindo as informações já disponíveis na oferta. O perfil detalhado não pôde ser atualizado.
            </p>:null}
          <div className="flex items-start gap-2 rounded-2xl border border-[#E6E8ED] bg-white p-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#C91429]"/>
            <p className="text-[11px] font-medium leading-5 text-[#5B6471]">Exibimos apenas nome, fotografia e avaliação autorizados para esta oferta. Preferências adicionais não foram informadas.</p>
          </div>
        </div>
      )}
    </DialogContent>
  </Dialog>;
}
