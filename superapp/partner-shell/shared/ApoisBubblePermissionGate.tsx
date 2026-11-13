// APOIS_PARCEIRO_QA240_FIRST_USE_PERMISSION_V1
// Shown once on first Android Motorista entry until the OS grants overlay access.
// The Android system owns the permission; the app only guides and rechecks.
import {useEffect,useState} from "react";
import {Capacitor,registerPlugin} from "@capacitor/core";
import {App} from "@capacitor/app";
import {ArrowRight,ArrowLeftRight,CheckCircle2,Navigation2,ShieldCheck,Loader2} from "lucide-react";
import officialApoisLogo from "@/assets/apois-return-logo.png";

type OverlayResult={granted:boolean;supported:boolean};
type OverlayPermissionBridge={
  bubbleStatus():Promise<OverlayResult>;
  requestBubblePermission():Promise<{granted:boolean}>;
};
const PermissionBridge=registerPlugin<OverlayPermissionBridge>("APOISExternalNavigation");

export function ApoisBubblePermissionGate({role}:{role:"motorista"|"entregador"}){
  const isAndroid=Capacitor.isNativePlatform()&&Capacitor.getPlatform()==="android";
  const setupTitle=role==="motorista"?"Configuração inicial do motorista":"Configuração inicial do entregador";
  const [state,setState]=useState<"checking"|"required"|"granted"|"unavailable">("checking");
  const [opening,setOpening]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    if(!isAndroid)return;
    let disposed=false;
    const check=()=>{
      void PermissionBridge.bubbleStatus().then(result=>{
        if(disposed)return;
        setState(!result.supported?"unavailable":result.granted?"granted":"required");
        if(result.granted)setMessage("");
      }).catch(()=>{
        if(!disposed){
          // Never trap the driver in an inaccessible blocking dialog if the
          // native plugin is unavailable (e.g. browser preview or unsupported OS).
          setState("unavailable");
        }
      });
    };
    check();
    let sub:{remove:()=>Promise<void>}|null=null;
    void App.addListener("appStateChange",({isActive})=>{
      if(isActive&&!disposed)check(); // Automatically closes this setup when granted.
    }).then(handle=>{
      if(disposed)void handle.remove();
      else sub=handle;
    }).catch(()=>undefined);
    const onVisible=()=>{if(document.visibilityState==="visible"&&!disposed)check();};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{disposed=true;document.removeEventListener("visibilitychange",onVisible);
      if(sub)void sub.remove();
    };
  },[isAndroid]);

  async function openAndroidSettings(){
    if(opening)return;
    setOpening(true);setMessage("");
    try{
      const result=await PermissionBridge.requestBubblePermission();
      if(result.granted)setState("granted");
      // The permission must be granted by the user in Android Settings.
      // On return, appStateChange automatically calls bubbleStatus().
    }catch{
      setMessage("Não foi possível abrir as permissões. Confira as configurações do Android.");
    }finally{setOpening(false);}
  }

  if(!isAndroid||state==="checking"||state==="granted"||state==="unavailable")return null;

  return (
    <div data-apois-qa240-bubble-permission="true"
      className="fixed inset-0 z-[9998] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#06070A]/95 px-4 py-[max(20px,env(safe-area-inset-top))] pb-[max(20px,env(safe-area-inset-bottom))] backdrop-blur-md"
      role="dialog" aria-modal="true" aria-labelledby="apois-bubble-heading">
      <section className="relative my-auto w-full max-w-[420px] overflow-hidden rounded-[30px] border border-[#35363C] bg-[#101115] px-6 pb-7 pt-7 text-white shadow-[0_30px_100px_rgba(0,0,0,.5)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-64 w-64 rounded-full bg-[#E51B23]/20 blur-[75px]"/>
        <div className="relative flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-[26px] border border-white/15 bg-white p-2 shadow-[0_16px_36px_rgba(229,27,35,.24)]">
            <img src={officialApoisLogo} alt="APOIS" className="h-full w-full object-contain"/>
          </div>
          <p className="mt-5 text-[10px] font-extrabold uppercase tracking-[.22em] text-[#FF7980]">{setupTitle}</p>
          <h1 id="apois-bubble-heading" className="mt-3 text-[27px] font-black leading-[1.13] tracking-[-.04em]">
            Volte à corrida<br/><span className="text-[#FF515D]">com um toque.</span>
          </h1>
          <p className="mt-3 max-w-[320px] text-[13px] font-medium leading-6 text-[#CBD0D8]">
            A logomarca APOIS ficará na lateral do Google Maps ou Waze durante {role==="motorista"?"a corrida":"a entrega"}. Toque nela para voltar diretamente ao aplicativo.
          </p>
          <div className="mt-5 flex w-full items-center justify-center gap-3 rounded-[20px] border border-white/10 bg-white/[.045] px-3 py-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-white p-1.5">
              <img src={officialApoisLogo} alt="" className="h-full w-full object-contain"/>
            </div>
            <ArrowLeftRight aria-hidden="true" className="h-5 w-5 text-[#FF606A]"/>
            <div className="flex h-11 items-center gap-2 rounded-[13px] bg-[#242934] px-3 text-white">
              <Navigation2 aria-hidden="true" className="h-5 w-5 text-[#FF515D]"/>
              <span className="text-[12px] font-extrabold">Google Maps / Waze</span>
            </div>
          </div>
          <div className="mt-5 flex w-full items-start gap-2 rounded-[15px] border border-white/10 bg-[#191B20] px-3.5 py-3 text-left">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[#FF616A]"/>
            <p className="text-[11px] font-medium leading-[1.65] text-[#D1D5DB]">
              O Android abrirá as permissões. Se aparecer uma lista, selecione <strong className="font-extrabold text-white">APOIS Parceiro</strong> e autorize <strong className="font-extrabold text-white">Exibir sobre outros aplicativos</strong>.
            </p>
          </div>
          {message?<p role="alert" className="mt-3 text-[12px] font-semibold text-[#FF8D96]">{message}</p>:null}
          <button type="button" disabled={opening} onClick={()=>void openAndroidSettings()}
            className="mt-5 flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-[17px] bg-[#E51B23] px-4 py-3 text-[14px] font-black text-white shadow-[0_12px_32px_rgba(229,27,35,.27)] transition active:scale-[.985] hover:bg-[#F32630] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF606A]/40 disabled:opacity-60">
            {opening?<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true"/>:<CheckCircle2 className="h-5 w-5" aria-hidden="true"/>}
            {opening?"Abrindo permissões…":"Autorizar retorno flutuante"}
            {!opening?<ArrowRight className="h-5 w-5" aria-hidden="true"/>:null}
          </button>
          <p className="mt-3 text-[10px] font-medium leading-4 text-[#99A2AF]">
            A verificação é automática ao voltar das configurações. O APOIS não concede essa permissão sem sua autorização.
          </p>
        </div>
      </section>
    </div>
  );
}
