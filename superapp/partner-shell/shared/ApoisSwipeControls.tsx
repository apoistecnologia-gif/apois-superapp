// APOIS_PARTNER_QA234_SWIPE_CONTROLS_V1
// Reusable deliberate gestures for irreversible operational actions.
// Pointer capture works in Android WebView; keyboard activation remains available.
// Never changes status by itself: only invokes the original backend callback.
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";

type Tone = "primary" | "neutral" | "danger";
type Action = () => void | Promise<void>;
const threshold=0.79;
const thumbWidth=46;
function clamp(v:number){return Math.max(0,Math.min(1,v));}

export function ApoisSlideAction({ label, onConfirm, disabled=false, busy=false, tone="primary", className="" }:{
 label:string;onConfirm:Action; disabled?:boolean;busy?:boolean;tone?:Tone;className?:string;
}){
 const track=useRef<HTMLDivElement>(null);
 const activePointer=useRef<number|null>(null);
 const begin=useRef(0);
 const progressRef=useRef(0);
 const lock=useRef(false);
 const [progress,setProgress]=useState(0);
 const [pending,setPending]=useState(false);
 const [failure,setFailure]=useState("");
 const locked=disabled||busy||pending;
 const color=tone==="danger"?"#9D202B":tone==="neutral"?"#374151":"#D51A29";
 const move=useCallback((v:number)=>{const p=clamp(v);progressRef.current=p;setProgress(p);},[]);
 const fire=useCallback(async ()=>{
   if(locked||lock.current)return;
   lock.current=true;setPending(true);setFailure("");move(1);
   try {await onConfirm();}
   catch(error){setFailure(error instanceof Error?error.message:"Não foi possível concluir a ação.");}
   finally {lock.current=false;setPending(false);move(0);}
 },[locked,onConfirm,move]);
 useEffect(()=>{if(disabled){activePointer.current=null;move(0);}},[disabled,move]);
 function geometry(){return Math.max(1,(track.current?.getBoundingClientRect().width??260)-thumbWidth-8);}
 function onDown(e:ReactPointerEvent<HTMLButtonElement>){
   if(locked||activePointer.current!==null)return;
   e.preventDefault();
   activePointer.current=e.pointerId;begin.current=e.clientX-progressRef.current*geometry();
   e.currentTarget.setPointerCapture(e.pointerId);
 }
 function onMove(e:ReactPointerEvent<HTMLButtonElement>){
   if(activePointer.current!==e.pointerId)return;
   move((e.clientX-begin.current)/geometry());
 }
 function onUp(e:ReactPointerEvent<HTMLButtonElement>){
   if(activePointer.current!==e.pointerId)return;
   activePointer.current=null;
   if(e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
   const complete=progressRef.current>=threshold;
   if(complete)void fire();else move(0);
 }
 function onCancel(){activePointer.current=null;move(0);}
 function onKey(e:ReactKeyboardEvent<HTMLButtonElement>){
   if(locked)return;
   if(e.key==="Enter"||e.key===" "){e.preventDefault();void fire();}
 }
 return (
  <div className={"min-w-0 w-full "+className} data-apois-slide-action="true">
   <div ref={track} className="relative h-[56px] w-full overflow-hidden rounded-2xl border border-[#B80E23] bg-[#C91429] shadow-[0_5px_16px_rgba(201,20,41,0.19)]"
        style={{touchAction:"pan-y"}}>
    <div className="absolute inset-y-0 left-0 rounded-2xl transition-colors"
         style={{width:(progress*100)+"%",background:"#850F1E",opacity:progress>.1?.35:0}} />
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center pl-9 pr-2 text-center">
      <span className="truncate text-[13px] font-extrabold uppercase tracking-[.025em] text-white">
        {pending||busy?"Processando…":label}
      </span>
      <span className="ml-1 text-[15px] font-bold text-white/75">›</span>
    </div>
    <button type="button" disabled={locked} aria-label={"Deslize para "+label+". Teclado: Enter para confirmar."}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}
      onPointerCancel={onCancel} onLostPointerCapture={onCancel} onKeyDown={onKey}
      className="absolute top-[4px] grid h-[46px] w-[46px] select-none place-items-center rounded-[13px] bg-white text-[#B91C2B] shadow-[0_2px_6px_rgba(0,0,0,.22)] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#851323] disabled:opacity-70"
      style={{left:"4px",transform:"translateX("+Math.round(progress*geometry())+"px)",background:"#FFFFFF",touchAction:"none"}}>
      <span aria-hidden="true" className="text-[25px] leading-none font-black text-[#C91429]">{pending||busy?"·":"›"}</span>
    </button>
   </div>
   {failure?<p role="alert" className="mt-1 text-xs font-semibold text-[#B42318]">{failure}</p>:null}
  </div>
 );
}

export function ApoisOfferSwipe({acceptLabel="Aceitar",rejectLabel="Recusar",onAccept,onReject,disabled=false}:{
 acceptLabel?:string;rejectLabel?:string;onAccept:Action;onReject:Action;disabled?:boolean;
}){
 const track=useRef<HTMLDivElement>(null);
 const pointer=useRef<number|null>(null);
 const origin=useRef(0);
 const offset=useRef(0);
 const locked=useRef(false);
 const [position,setPosition]=useState(0);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState("");
 const busy=disabled||pending;
 function radius(){return Math.max(1,((track.current?.getBoundingClientRect().width??280)-thumbWidth-12)/2);}
 function set(v:number){const next=Math.max(-1,Math.min(1,v));offset.current=next;setPosition(next);}
 async function decide(dir:-1|1){
   if(busy||locked.current)return;
   locked.current=true;setPending(true);setError("");set(dir);
   try{await (dir===1?onAccept:onReject)();}
   catch(e){setError(e instanceof Error?e.message:"A ação não pôde ser concluída.");}
   finally{locked.current=false;setPending(false);set(0);}
 }
 function down(e:ReactPointerEvent<HTMLButtonElement>){
   if(busy||pointer.current!==null)return;
   e.preventDefault();pointer.current=e.pointerId;origin.current=e.clientX-offset.current*radius();
   e.currentTarget.setPointerCapture(e.pointerId);
 }
 function moving(e:ReactPointerEvent<HTMLButtonElement>){
   if(pointer.current!==e.pointerId)return;set((e.clientX-origin.current)/radius());
 }
 function up(e:ReactPointerEvent<HTMLButtonElement>){
   if(pointer.current!==e.pointerId)return;
   pointer.current=null;
   if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
   const p=offset.current;
   if(Math.abs(p)>=threshold)void decide(p>0?1:-1);else set(0);
 }
 function cancel(){pointer.current=null;set(0);}
 function key(e:ReactKeyboardEvent<HTMLButtonElement>){
   if(busy)return;
   if(e.key==="ArrowRight"){e.preventDefault();void decide(1);}
   else if(e.key==="ArrowLeft"){e.preventDefault();void decide(-1);}
 }
 return (
  <div data-apois-offer-swipe="true" className="w-full min-w-0">
   <div ref={track} className="relative h-[58px] w-full overflow-hidden rounded-2xl border border-[#CFD4DC] bg-[#F7F8FA]"
        style={{touchAction:"pan-y"}}>
    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[11px] font-extrabold text-[#4B5563]">‹ {rejectLabel}</span>
    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] font-extrabold text-[#C9141B]">{acceptLabel} ›</span>
    <span className="pointer-events-none absolute inset-0 grid place-items-center text-[10px] font-semibold text-[#737B88]" style={{opacity:Math.max(0,1-Math.abs(position)*3)}}>Arraste</span>
    <button type="button" disabled={busy} aria-label={"Deslize para a esquerda para "+rejectLabel+" ou direita para "+acceptLabel+". Teclado: setas."}
      onPointerDown={down} onPointerMove={moving} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={key}
      className="absolute top-[4px] left-1/2 grid h-[48px] w-[48px] -translate-x-1/2 select-none place-items-center rounded-xl bg-[#D91920] text-white shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D91920] disabled:opacity-60"
      style={{transform:"translateX(calc(-50% + "+Math.round(position*radius())+"px))",touchAction:"none"}}>
      <span aria-hidden className="text-lg font-bold">‹ ›</span>
    </button>
   </div>
   {error?<p role="alert" className="mt-1 text-xs text-red-600">{error}</p>:null}
  </div>
 );
}
