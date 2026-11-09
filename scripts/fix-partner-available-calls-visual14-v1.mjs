// APOIS RV-14 — only the generated Partner workspaces, never pinned sources.
import {readFileSync, writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

export const MARK="APOIS_CV14_AVAILABLE_CALLS_STATE_V1";
const logic=String.raw`
  // APOIS_CV14_AVAILABLE_CALLS_STATE_V1: list retrieval and claim results are independent.
  const [message,setMessage]=useState<string|null>(null);
  const [claimMessage,setClaimMessage]=useState<string|null>(null);
  const [updatedAtMs,setUpdatedAtMs]=useState<number|null>(null);
  const [nowMs,setNowMs]=useState(()=>Date.now());
  const generationRef=useRef(0);
  const requestRef=useRef(0);
  const stateRef=useRef({open,online,role});
  const dialogRef=useRef<HTMLDivElement|null>(null);
  const closeRef=useRef<HTMLButtonElement|null>(null);
  stateRef.current={open,online,role};

  // Local estimate is presentation only; RPC is the authority on eligibility/expiry.
  const remaining=(call:Call)=>Math.max(0,Math.ceil(call.remaining_seconds-Math.max(0,nowMs-(updatedAtMs??nowMs))/1000));
  const remainingText=(seconds:number)=>seconds<=0?"Prazo estimado encerrado":seconds<60?seconds+" s":
    Math.floor(seconds/60)+" min "+seconds%60+" s";
  const isStale=updatedAtMs!==null && nowMs-updatedAtMs>20000;

  const refresh=useCallback(async()=>{
    if(!online||!open){setCalls([]);return;}
    const generation=generationRef.current;
    const sequence=++requestRef.current;
    const isCurrent=()=>generation===generationRef.current && sequence===requestRef.current &&
      stateRef.current.open && stateRef.current.online && stateRef.current.role===role;
    setLoading(true);
    const rpcName=role==="motorista"?"apois_list_available_ride_calls":"apois_list_available_delivery_calls";
    try{
      const {data,error}=await (supabase as any).rpc(rpcName);
      if(error)throw error;
      if(!Array.isArray(data))throw Error("unexpected_response");
      const validated=data.filter((c:any)=>c && typeof c.id==="string" && typeof c.category==="string" &&
        typeof c.pickup_distance_km==="number" && Number.isFinite(c.pickup_distance_km) &&
        c.pickup_distance_km>=0 && c.pickup_distance_km<=20 &&
        typeof c.remaining_seconds==="number" && c.remaining_seconds>0).slice(0,10);
      if(!isCurrent())return;
      setCalls(validated);
      const receivedAt=Date.now();
      setUpdatedAtMs(receivedAt);
      setNowMs(receivedAt);
      setMessage(null);
    }catch{
      if(!isCurrent())return;
      setCalls([]);
      setUpdatedAtMs(null);
      setMessage("Não foi possível consultar as solicitações. Verifique a conexão e tente novamente.");
    }finally{
      if(isCurrent())setLoading(false);
    }
  },[role,online,open]);

  useEffect(()=>{
    ++generationRef.current;
    ++requestRef.current;
    if(!open){
      setCalls([]);setMessage(null);setClaimMessage(null);setUpdatedAtMs(null);setLoading(false);
      return;
    }
    if(!online){
      setCalls([]);setUpdatedAtMs(null);setLoading(false);
      setMessage("Fique ONLINE para consultar solicitações.");
      return;
    }
    void refresh();
    const poll=window.setInterval(()=>{if(navigator.onLine)void refresh();},15000);
    const clock=window.setInterval(()=>setNowMs(Date.now()),1000);
    return()=>{
      ++generationRef.current;
      ++requestRef.current;
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  },[open,online,role,refresh]);

  useEffect(()=>{
    if(!open)return;
    const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const frame=window.requestAnimationFrame(()=>closeRef.current?.focus());
    return()=>{
      window.cancelAnimationFrame(frame);
      previouslyFocused?.focus();
    };
  },[open]);

  const trapKeys=(event:KeyboardEvent<HTMLDivElement>)=>{
    if(event.key==="Escape"){event.preventDefault();onClose();return;}
    if(event.key!=="Tab")return;
    const buttons=Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])")??[]);
    if(!buttons.length){event.preventDefault();return;}
    const first=buttons[0],last=buttons[buttons.length-1];
    if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
  };

  const claim=async(call:Call)=>{
    if(claiming||!online||isStale||remaining(call)===0)return;
    setClaiming(call.id);setClaimMessage(null);
    try{
      const rpcName=role==="motorista"?"apois_claim_available_ride_call":"apois_claim_available_delivery_call";
      const args=role==="motorista"?{_ride_id:call.id}:{_job_id:call.id};
      const {data,error}=await (supabase as any).rpc(rpcName,args);
      if(error||!data)throw Error("claim_failed");
      setCalls([]);
      onAccepted();
      onClose();
    }catch{
      if(stateRef.current.open && stateRef.current.online && stateRef.current.role===role){
        setClaimMessage("Não foi possível confirmar esta solicitação. Ela pode estar indisponível. Confira a lista antes de tentar outra.");
        await refresh();
      }
    }finally{setClaiming(null);}
  };
`;
function exactlyOnce(source,before,after,label){
  const occurrences=source.split(before).length-1;
  if(occurrences!==1)throw Error("[RV14] "+label+" anchor count="+occurrences);
  return source.replace(before,after);
}
function assertSource(source,role){
  for(const mark of ["apois_list_available_ride_calls","apois_list_available_delivery_calls",
      "apois_claim_available_ride_call","apois_claim_available_delivery_call",
      "if(error||!data)throw","remaining_seconds>0","onAccepted()","window.clearInterval(poll)"]){
    if(!source.includes(mark))throw Error("[RV14] "+role+" missing protected token "+mark);
  }
  return source;
}
export function patchAvailableCalls(source){
  if(source.includes(MARK)){
    for(const mark of ["setClaimMessage(","generationRef.current","remainingText(remaining(call))",
      "ref={dialogRef}","ref={closeRef}","aria-live=\"polite\"","min-h-11","isStale"]){
      if(!source.includes(mark))throw Error("[RV14] incomplete available calls: "+mark);
    }
    return assertSource(source,"idempotent");
  }
  assertSource(source,"original");
  let next=exactlyOnce(source,
    'import {useCallback,useEffect,useState} from "react";',
    'import {useCallback,useEffect,useRef,useState,type KeyboardEvent} from "react";',
    "React hooks");
  const startText='  const [message,setMessage]=useState<string|null>(null);';
  const endText='  if(!open)return null;';
  const start=next.indexOf(startText),end=next.indexOf(endText);
  if(start<0||end<start||next.indexOf(startText,start+1)!==-1||next.indexOf(endText,end+1)!==-1)
    throw Error("[RV14] available calls state section drift");
  const section=next.slice(start,end);
  for(const token of ['const refresh=useCallback(async()=>{','const claim=async(call:Call)=>{',
    'setMessage(null);','setCalls(validated);','await refresh();','if(error||!data)throw Error("claim_failed");']){
    if(!section.includes(token))throw Error("[RV14] missing original lifecycle "+token);
  }
  next=next.slice(0,start)+logic+"\n"+next.slice(end);
  next=exactlyOnce(next,
    '<div role="dialog" aria-modal="true" aria-labelledby="apois-available-calls"',
    '<div role="dialog" aria-modal="true" aria-labelledby="apois-available-calls" ref={dialogRef} onKeyDown={trapKeys}',
    "dialog keyboard lifecycle");
  next=exactlyOnce(next,
    'onClick={onClose} className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold"',
    'onClick={onClose} ref={closeRef} className="min-h-11 rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold"',
    "close touch");
  next=exactlyOnce(next,
    '{message&&<p role="status" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</p>}',
    '{message&&<p role="status" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{message}</p>}\n'+
    '      {claimMessage&&<p role="alert" className="mt-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{claimMessage}</p>}\n'+
    '      {loading&&<p role="status" aria-live="polite" className="text-sm text-zinc-600">Consultando solicitações…</p>}\n'+
    '      {isStale&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Informações sem atualização recente. Atualize para verificar a disponibilidade.</p>}',
    "separate feedback and stale list");
  next=exactlyOnce(next,
    '{Math.ceil(call.remaining_seconds/60)} min',
    '{remainingText(remaining(call))}',
    "precise estimated time");
  next=exactlyOnce(next,
    'disabled={claiming!==null||!online} onClick={()=>void claim(call)}',
    'disabled={claiming!==null||!online||isStale||remaining(call)===0} onClick={()=>void claim(call)}',
    "non-authoritative UI expiry guard");
  return patchAvailableCalls(next);
}
export function applyVisual14Calls(role,root=process.cwd()){
  if(!["motorista","entregador"].includes(role))throw Error("[RV14] role is required");
  const base=resolve(root,role==="motorista"?".work/partner-motorista":".work/partner-entregador");
  const file=resolve(base,"src/components/ApoisAvailableCalls.tsx");
  const before=readFileSync(file,"utf8"),after=patchAvailableCalls(before);
  if(before!==after)writeFileSync(file,after,"utf8");
  return {role,file:"src/components/ApoisAvailableCalls.tsx",changed:before!==after};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  console.log("[OK] RV14 Partner available calls",JSON.stringify(applyVisual14Calls(process.argv[2])));
}
