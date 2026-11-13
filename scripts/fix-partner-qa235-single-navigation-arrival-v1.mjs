// APOIS_PARTNER_QA235_ONE_NAVIGATION_V1
// Only generated disposable workspaces, no protected source edits.
import {readFileSync,writeFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
const role=process.argv[2];
if(!["motorista","entregador"].includes(role))throw Error("[FAIL] QA235 role");
const root=resolve(".work/partner-"+role);
function once(s,old,replacement,label){const n=s.split(old).length-1;if(n!==1)throw Error("[FAIL] QA235 "+label+" count="+n);return s.replace(old,replacement);}
function read(path){const p=resolve(root,path);if(!existsSync(p))throw Error("[FAIL] QA235 missing "+p);return readFileSync(p,"utf8");}
function write(path,source){writeFileSync(resolve(root,path),source,"utf8");}
let nav=read("src/components/ApoisExternalNavigation.tsx");
nav=once(nav,'import { ApoisSlideAction } from "./ApoisSwipeControls";\n',"","navigation no redundant swipe import");
const navOpen=nav.indexOf('        <ApoisSlideAction'),navClose=nav.indexOf('        />',navOpen);
if(navOpen<0||navClose<0||!nav.slice(navOpen,navClose).includes('label="Iniciar navegação"'))
 throw Error("[FAIL] QA235 navigation retry CTA");
nav=nav.slice(0,navOpen)+
 '        <button type="button" disabled={busy || !coordinateValid} onClick={launch}\n'+
 '          aria-label={"Reabrir navegação "+stage}\n'+
 '          className="min-h-11 min-w-0 flex-1 rounded-xl border border-[#E4B0B3] bg-[#FFF1F2] px-3 text-[12px] font-extrabold text-[#A31626] disabled:opacity-50">\n'+
 '          {busy ? "Abrindo…" : "Reabrir mapa"}\n'+
 '        </button>'+nav.slice(navClose+10);
if(nav.includes("<ApoisSlideAction"))throw Error("[FAIL] QA235 nav duplicate swipe");
write("src/components/ApoisExternalNavigation.tsx",nav);
if(role==="motorista"){
 let s=read("src/routes/motorista.app.tsx");
 let voice=read("src/lib/voiceNav.ts");
 const must=["APOIS_PARTNER_QA234_SWIPE_COST_V1","async function handleAccept()","function PickupNavOverlay(",
   '<ApoisOfferSwipe acceptLabel="Aceitar corrida"','label="Confirmar chegada" onConfirm={handleArrive}',
   "await onStart(pinCode);","haversineKm(","setPolyline(points);"];
 for(const t of must)if(!s.includes(t))throw Error("[FAIL] QA235 driver source "+t);
 s="// APOIS_PARTNER_QA235_ONE_NAVIGATION_V1\n"+
   'import { setApoisExternalNavigationOwnsVoice } from "@/lib/voiceNav";\n'+s;
 voice=once(voice,'export async function speak(text: string, opts?: { dedupKey?: string; interrupt?: boolean }) {',
   '// QA235: external maps controls all guidance voice during an active ride.\n'+
   'let qa235ExternalVoice=false;\n'+
   'export function setApoisExternalNavigationOwnsVoice(value:boolean){\n'+
   ' qa235ExternalVoice=value;\n'+
   ' if(value){synth()?.cancel();if(nativeVoiceAvailable())void NativeDriverVoice.stop().catch(()=>undefined);}\n'+
   '}\n'+
   'export async function speak(text: string, opts?: { dedupKey?: string; interrupt?: boolean }) {\n'+
   ' if(qa235ExternalVoice)return;',
   "disable internal native and fallback TTS when external navigator owns guidance");
 const activeState='  const [active, setActive] = useState<RideRow | null>(null);';
 s=once(s,activeState,activeState+'\n'+
   '  // QA235: silent operational map while Google Maps/Waze guides.\n'+
   '  useEffect(()=>{\n'+
   '    const current=Boolean(active && ["motorista_a_caminho","motorista_chegou","em_viagem"].includes(active.status));\n'+
   '    setApoisExternalNavigationOwnsVoice(current);\n'+
   '    return ()=>setApoisExternalNavigationOwnsVoice(false);\n'+
   '  },[active?.id,active?.status]);',
   "voice ownership lifecycle");
 s=once(s,
   '<DriverVoiceToggle\n        visible={!!active && (active.status === "motorista_a_caminho" || active.status === "em_viagem")}\n      />',
   '{/* QA235: no second voice controller during external guidance. */}',
   "remove confusing voice toggle");
 const dual='<ApoisOfferSwipe acceptLabel="Aceitar corrida" rejectLabel="Recusar" onAccept={onAccept} onReject={onReject} />';
 s=once(s,dual,
   '<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">'+
   '<ApoisSlideAction label="Aceitar corrida" onConfirm={onAccept} />'+
   '<button type="button" onClick={onReject} className="min-h-11 rounded-xl border border-[#D1D5DB] bg-white px-3 text-xs font-bold text-[#475467]">Recusar</button>'+
   '</div>',"one offer confirmation plus normal reject");
 s=once(s,'import { ApoisSlideAction, ApoisOfferSwipe } from "@/components/ApoisSwipeControls";',
   'import { ApoisSlideAction } from "@/components/ApoisSwipeControls";',"remove two-way slider");
 s=once(s,
   '<ApoisSlideAction label="Confirmar chegada" onConfirm={handleArrive} disabled={arriveBusy} busy={arriveBusy} />',
   '<div data-apois-automatic-arrival="true" className="rounded-xl bg-[#FFF1F2] px-3 py-2 text-center text-xs font-semibold text-[#9E1B2A]">O passageiro será avisado automaticamente pelo GPS.</div>',
   "remove manual arrival CTA");
 // Original accept action remains unchanged and may return queued_after_ride_id.
 // Only non-queued, successfully accepted rides open navigation to pickup.
 s=once(s,'        setActive(accepted);\n        sheetRef.current?.snapTo(34);',
   '        setActive(accepted);\n'+
   '        setApoisExternalNavigationOwnsVoice(true);\n'+
   '        void launchApoisNavigationAfterRideStart(accepted.origin_lat, accepted.origin_lng)\n'+
   '          .catch((error)=>{console.warn("[APOIS] Navegação após aceite indisponível",error);'+
   'toast.info("Corrida aceita. Use Reabrir mapa se necessário.");});\n'+
   '        sheetRef.current?.snapTo(34);',
   "open preferred navigator immediately after confirmed non-queued accept");
 // GPS arrival uses three GPS updates within 85m separated across 6.5 sec,
 // existing server arrive transition, existing passenger push. Failures
 // retry at most every 30 sec. No spoof based on map position, no status fake.
 const ref='  useEffect(() => { activeRef.current = active; }, [active]);';
 const autoLines=[
'  // QA235: avoid a false arrival from one noisy GPS fix.',
'  const qa235ArrivalRef=useRef<{rideId:string;firstAt:number;lastAt:number;count:number;busy:boolean;retryAfter:number}|null>(null);',
'  useEffect(()=>{',
'    if(!active||active.status!=="motorista_a_caminho"||gpsStatus!=="granted"||!position){qa235ArrivalRef.current=null;return;}',
'    const distance=haversineKm(position,{lat:active.origin_lat,lng:active.origin_lng})*1000;',
'    if(!Number.isFinite(distance)||distance>85){qa235ArrivalRef.current=null;return;}',
'    const now=Date.now();',
'    const old=qa235ArrivalRef.current;',
'    const record=old?.rideId===active.id?old:{rideId:active.id,firstAt:now,lastAt:0,count:0,busy:false,retryAfter:0};',
'    qa235ArrivalRef.current=record;',
'    if(record.busy||now<record.retryAfter||now-record.lastAt<2500)return;',
'    record.lastAt=now;record.count+=1;',
'    if(record.count<3||now-record.firstAt<6500)return;',
'    record.busy=true;',
'    const rideId=active.id;',
'    void callArrive({data:{rideId}}).then(()=>{',
'      if(activeRef.current?.id===rideId&&activeRef.current.status==="motorista_a_caminho"){',
'        setActive((current)=>current?.id===rideId?{...current,status:"motorista_chegou"}:current);',
'      }',
'      qa235ArrivalRef.current=null;',
'    }).catch((error)=>{',
'      console.warn("[APOIS] GPS próximo, backend ainda não confirmou chegada.",error);',
'      record.busy=false;record.count=0;record.firstAt=Date.now();record.retryAfter=Date.now()+30000;',
'    });',
'  },[active?.id,active?.status,position,gpsStatus,callArrive]);'
 ].join("\n");
 s=once(s,ref,ref+'\n'+autoLines,"bounded GPS proximity arrival and backend push");
 // The internal map is operational but no longer an active auto-follow
 // navigation camera. Manual recenter and route overview still work.
 const begin=s.indexOf("function applyNavigationCamera(");
 const entry=begin<0?-1:s.indexOf(") {\n  const now=Date.now();",begin);
 if(begin<0||entry<0||entry-begin>850||!s.slice(begin,entry).includes("immediate"))
  throw Error("[FAIL] QA235 camera function entry moved");
 const insertion=entry+4;
 s=s.slice(0,insertion)+'\n  // QA235: no continuous internal navigation camera while external map guides.\n  if(!immediate)return;'+s.slice(insertion);
 for(const t of ["onConfirm={submitPin}","onConfirm={handleComplete}","onClick={onRecenter}",
   "onClick={onShowRoute}","data-apois-qa220-pin-digit-v1","launchApoisNavigationAfterRideStart(accepted.origin_lat",
   "qa235ArrivalRef.current","setPolyline(points);"]){
  if(!s.includes(t))throw Error("[FAIL] QA235 driver preserved "+t);
 }
 write("src/lib/voiceNav.ts",voice);write("src/routes/motorista.app.tsx",s);
 console.log("[OK] QA235 Motorista: one external voice, auto-start after accept, automatic arrival push");
}else{
 let offers=read("src/components/CourierOfferOverlay.tsx");
 offers=once(offers,
  '<ApoisOfferSwipe acceptLabel="Aceitar entrega" rejectLabel="Recusar" disabled={Boolean(busy)} onAccept={() => respond("accept")} onReject={() => respond("reject")} />',
  '<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">'+
  '<ApoisSlideAction label="Aceitar entrega" disabled={Boolean(busy)} onConfirm={() => respond("accept")} />'+
  '<button type="button" disabled={Boolean(busy)} onClick={() => void respond("reject")} className="min-h-11 rounded-xl border border-[#D1D5DB] bg-white px-3 text-xs font-bold text-[#475467]">Recusar</button>'+
  '</div>',
  "courier single offer slider");
 offers=once(offers,'import { ApoisOfferSwipe } from "@/components/ApoisSwipeControls";',
  'import { ApoisSlideAction } from "@/components/ApoisSwipeControls";',"drop courier dual slider");
 for(const t of ['onConfirm={() => respond("accept")}','onClick={() => void respond("reject")}',
    'accept_delivery_offer','reject_delivery_offer']){
  if(!offers.includes(t))throw Error("[FAIL] QA235 courier callback "+t);
 }
 write("src/components/CourierOfferOverlay.tsx",offers);
 console.log("[OK] QA235 Entregador: clean one offer slider and simple retry navigation");
}
