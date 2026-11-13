// APOIS_PARTNER_QA236_PIN_DIALOG_V1
// PIN entry belongs to the APOIS operational flow, not to an external map.
// This dialog remains mounted across real-time GPS "arrived" status changes.
import {useState} from "react";
import {ApoisSlideAction} from "./ApoisSwipeControls";

export function ApoisPickupPin({onClose,onSubmit}:{
  onClose:()=>void;
  onSubmit:(code:string)=>Promise<void>;
}){
  const [pin,setPin]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const valid=/^\d{4}$/.test(pin);
  async function confirm(){
    if(busy||!valid)return;
    setBusy(true);setError("");
    try{await onSubmit(pin);onClose();}
    catch(e){setError(e instanceof Error?e.message:"Não foi possível iniciar a corrida.");}
    finally{setBusy(false);}
  }
  return (
    <div role="dialog" aria-modal="true" aria-label="Iniciar corrida com PIN"
      data-apois-qa236-pin-dialog="true"
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/60 px-0 pb-0 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-[28px] bg-white p-5 shadow-2xl"
        style={{paddingBottom:"calc(env(safe-area-inset-bottom) + 20px)"}}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#C91429]">APOIS Corridas</p>
            <h2 className="mt-1 text-[23px] font-extrabold text-[#111827]">Iniciar corrida</h2>
          </div>
          <button type="button" aria-label="Fechar PIN" onClick={onClose} disabled={busy}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#F3F4F6] text-xl font-bold text-[#374151]">×</button>
        </div>
        <p className="mt-3 text-[13px] text-[#4B5563]">Peça ao passageiro o código de quatro números para iniciar a viagem.</p>
        <label htmlFor="qa236-ride-pin" className="mt-4 block text-xs font-bold uppercase tracking-wide text-[#374151]">PIN do passageiro</label>
        <input id="qa236-ride-pin" data-apois-qa236-pin="true" autoFocus
          type="text" inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code"
          maxLength={4} value={pin} onChange={(event)=>{setPin(event.target.value.replace(/\D/g,"").slice(0,4));setError("");}}
          placeholder="0000"
          className="mt-2 h-16 w-full rounded-2xl border-2 border-[#D1D5DB] bg-white text-center text-[32px] font-extrabold tracking-[.55em] text-[#111827] outline-none focus:border-[#C91429]"
          style={{color:"#111827",WebkitTextFillColor:"#111827"}}/>
        {error?<p role="alert" className="mt-2 text-sm font-semibold text-[#B42318]">{error}</p>:null}
        <div className="mt-4">
          <ApoisSlideAction label="Confirmar PIN e iniciar corrida" disabled={!valid||busy} busy={busy} onConfirm={confirm}/>
        </div>
      </div>
    </div>
  );
}
