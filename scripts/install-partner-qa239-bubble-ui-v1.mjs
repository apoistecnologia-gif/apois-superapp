// APOIS_PARTNER_QA239_BUBBLE_UI_V1
// Runs after QA235/236 in disposable Motorista only. Courier is unchanged.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/components/ApoisExternalNavigation.tsx");
let s=readFileSync(file,"utf8");
if(s.includes("APOIS_PARTNER_QA239_BUBBLE_UI_V1"))throw Error("[QA239] duplicate bubble UI");
function one(a,b,name){const n=s.split(a).length-1;if(n!==1)throw Error("[QA239] "+name+" anchors="+n);s=s.replace(a,b);}
if(!s.includes("Reabrir mapa")||!s.includes("export function ApoisExternalNavigation("))
 throw Error("[QA239] QA235 existing Google/Waze UI required");
one("type ExternalPlugin = {\n",[
"type ExternalPlugin = {",
"  // APOIS_PARTNER_QA239_BUBBLE_UI_V1: optional, Android-only.",
"  bubbleStatus(): Promise<{enabled:boolean;permission:boolean}>;",
"  setBubbleEnabled(options:{enabled:boolean}): Promise<{enabled:boolean;permission:boolean}>;",
"  openBubbleSettings(): Promise<void>;",
""].join("\n"),"bridge typing");
one('  const [message, setMessage] = useState("");',[
'  const [message, setMessage] = useState("");',
'  const [bubbleState,setBubbleState]=useState<{enabled:boolean;permission:boolean}>({enabled:false,permission:false});',
'  const [bubbleBusy,setBubbleBusy]=useState(false);',
'  useEffect(()=>{',
'    if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=="android")return;',
'    let live=true;',
'    const refresh=()=>void NativeNavigation.bubbleStatus().then(s=>{if(live)setBubbleState(s);}).catch(()=>undefined);',
'    refresh();',
'    let handle:{remove:()=>Promise<void>}|null=null;',
'    void App.addListener("appStateChange",({isActive})=>{if(isActive)refresh();}).then(h=>{if(live)handle=h;else void h.remove();}).catch(()=>undefined);',
'    return ()=>{live=false;if(handle)void handle.remove();};',
'  },[]);',
'  const changeBubble=async()=>{',
'    if(bubbleBusy)return;',
'    setBubbleBusy(true);',
'    try {',
'      if(bubbleState.enabled&&bubbleState.permission){',
'        setBubbleState(await NativeNavigation.setBubbleEnabled({enabled:false}));',
'      }else{',
'        const next=await NativeNavigation.setBubbleEnabled({enabled:true});',
'        setBubbleState(next);',
'        if(!next.permission){',
'          setMessage("Autorize Exibir sobre outros aplicativos. O Android pode mostrar a lista de aplicativos.");',
'          await NativeNavigation.openBubbleSettings();',
'        }else setMessage("Bolha APOIS habilitada. Ela aparecerá apenas durante a navegação externa de uma corrida.");',
'      }',
'    }catch{setMessage("Não foi possível configurar a bolha. Continue usando a notificação Voltar ao APOIS.");}',
'    finally{setBubbleBusy(false);}',
'  };'
].join("\n"),"bubble hook and user action");
one('      {message ? <p role="status" className="mt-1 text-xs font-semibold text-[#AF1830]">{message}</p> : null}',
[
'      {message ? <p role="status" className="mt-1 text-xs font-semibold text-[#AF1830]">{message}</p> : null}',
'      {Capacitor.isNativePlatform()&&Capacitor.getPlatform()==="android" ? (',
'        <button type="button" data-apois-bubble-consent="true" disabled={bubbleBusy} onClick={()=>void changeBubble()}',
'          className="mt-2 min-h-11 w-full rounded-xl border border-[#F4CDD0] bg-[#FFF6F6] px-3 text-[11px] font-bold text-[#B91C1C] disabled:opacity-60">',
'          {bubbleState.enabled&&bubbleState.permission ? "Bolha APOIS ligada • Desativar" :',
'           bubbleState.enabled ? "Autorizar bolha sobre o mapa" : "Ativar bolha de retorno ao APOIS"}',
'        </button>',
'      ) : null}',
'      {coordinateValid&&Capacitor.isNativePlatform()&&Capacitor.getPlatform()==="android" ? (',
'        <button type="button" data-apois-floating-reopen-map="true"',
'          aria-label="Voltar ao Google Maps ou Waze" disabled={busy}',
'          onClick={()=>void openProvider(preferred ?? "google")}',
'          className="fixed right-3 top-[calc(env(safe-area-inset-top)+160px)] z-30 grid h-12 w-12 place-items-center rounded-full border-2 border-white bg-[#E51B23] text-xl font-black text-white shadow-lg disabled:opacity-50">↗</button>',
'      ) : null}'
].join("\n"),"new consent and in-APOIS quick return");
writeFileSync(file,s,"utf8");
console.log("[OK] QA239: Android opt-in bubble action, foreground status refresh, visible return-to-map button");
