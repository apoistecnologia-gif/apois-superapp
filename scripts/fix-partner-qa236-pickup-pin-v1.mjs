// APOIS_PARTNER_QA236_PICKUP_PIN_V1
// Post-QA235 disposable Motorista workspace, pinned source remains untouched.
import {readFileSync,writeFileSync,copyFileSync} from "node:fs";
import {resolve} from "node:path";
const base=resolve(".work/partner-motorista");
const file=resolve(base,"src/routes/motorista.app.tsx");
let s=readFileSync(file,"utf8");
const marker="APOIS_PARTNER_QA236_PICKUP_PIN_V1";
function once(src,a,b,name){const n=src.split(a).length-1;if(n!==1)throw Error("[FAIL] QA236 "+name+" anchors="+n);return src.replace(a,b);}
if(s.includes(marker)||!s.includes("APOIS_PARTNER_QA235_ONE_NAVIGATION_V1"))
  throw Error("[FAIL] QA236 must run once after QA235");
copyFileSync(resolve("superapp/partner-shell/shared/ApoisPickupPin.tsx"),
 resolve(base,"src/components/ApoisPickupPin.tsx"));
s="// "+marker+": one visible ride-start button and PIN during GPS pending.\n"+
 'import {ApoisPickupPin} from "@/components/ApoisPickupPin";\n'+s;
s=once(s,'  const [active, setActive] = useState<RideRow | null>(null);',
 '  const [active, setActive] = useState<RideRow | null>(null);\n  const [qa236PinOpen,setQa236PinOpen]=useState(false);',
 "ride PIN state independent of status transition");

// Repair the actual QA235 pickup footer, which erroneously contains only
// a notice while the PIN belongs to a different route phase.
const a=s.indexOf("function PickupNavOverlay("),b=s.indexOf("\nfunction CircleAction(",a);
if(a<0||b<=a)throw Error("[FAIL] QA236 pickup component");
let pickup=s.slice(a,b);
pickup=once(pickup,"  onArrive,\n","  onStartPin,\n","replace unused pickup onArrive prop");
pickup=once(pickup,"  onArrive: () => Promise<void> | void;","  onStartPin: () => void;","typed pickup PIN action");
pickup=once(pickup,"  const [arriveBusy, setArriveBusy] = useState(false);\n","","drop dead arrival busy");
const ha=pickup.indexOf("  const handleArrive = async () => {"),hb=pickup.indexOf("  const handleCancel = async () => {",ha);
if(ha<0||hb<=ha)throw Error("[FAIL] QA236 old arrival handler");
pickup=pickup.slice(0,ha)+pickup.slice(hb);
pickup=once(pickup,
 '<div data-apois-automatic-arrival="true" className="rounded-xl bg-[#FFF1F2] px-3 py-2 text-center text-xs font-semibold text-[#9E1B2A]">O passageiro será avisado automaticamente pelo GPS.</div>',
 '<button type="button" data-apois-qa236-start-ride="true" onClick={onStartPin} '+
 'className="min-h-[54px] w-full rounded-2xl bg-[#C91429] px-4 text-[15px] font-extrabold uppercase tracking-wide text-white shadow-[0_8px_20px_-10px_rgba(201,20,41,.5)]">'+
 'Iniciar corrida · Digitar PIN</button>',
 "replace GPS announcement with ride PIN CTA");
s=s.slice(0,a)+pickup+s.slice(b);

// Arrived phase already contains the QA209 PIN modal. Make its entry a
// simple button so there is never a double-slide just to start the trip.
s=once(s,'<ApoisSlideAction label="Iniciar corrida" onConfirm={() => { setPinError(null); setPinCode(""); setPinOpen(true); }} />',
 '<button type="button" data-apois-qa236-arrived-pin="true" onClick={() => { setPinError(null); setPinCode(""); setPinOpen(true); }} '+
 'className="min-h-[52px] w-full rounded-2xl bg-[#C91429] px-4 text-sm font-extrabold uppercase text-white">'+
 'Iniciar corrida · Digitar PIN</button>',"confirmed arrived entry uses only simple button");

// Place the PIN dialog outside the pickup conditional, so a native GPS
// arrival in the middle of input never destroys the user's four digits.
const modal=[
'      {/* QA236: pickup PIN independent of the automatic native GPS transition. */}',
'      {qa236PinOpen && active && ["motorista_a_caminho","motorista_chegou"].includes(active.status) && (',
'        <ApoisPickupPin onClose={()=>setQa236PinOpen(false)} onSubmit={async(code)=>{',
'          const ride=activeRef.current;',
'          if(!ride || ride.id!==active.id || !["motorista_a_caminho","motorista_chegou"].includes(ride.status))',
'            throw Error("A corrida mudou. Volte para a tela principal e tente novamente.");',
'          if(ride.status==="motorista_a_caminho"){',
'            const fix=await Geolocation.getCurrentPosition({enableHighAccuracy:true,timeout:12000,maximumAge:3000});',
'            const point={lat:fix.coords.latitude,lng:fix.coords.longitude};',
'            const distance=haversineKm(point,{lat:ride.origin_lat,lng:ride.origin_lng})*1000;',
'            const accuracy=fix.coords.accuracy;',
'            if(!Number.isFinite(distance)||distance>150||!Number.isFinite(accuracy)||accuracy>100)',
'              throw Error("Aproxime-se do embarque e aguarde um GPS preciso para iniciar a corrida.");',
'            try{await callArrive({data:{rideId:ride.id}});}',
'            catch(error){',
'              // Native service may have just confirmed arrival in parallel.',
'              const {data:server,error:loadError}=await supabase.from("rides")',
'                .select("status").eq("id",ride.id).maybeSingle();',
'              if(loadError||server?.status!=="motorista_chegou")throw error;',
'            }',
'          }',
'          await callStart({data:{rideId:ride.id,safety_code:code}});',
'          setActive(current=>current?.id===ride.id?{...current,status:"em_viagem"}:current);',
'          setQa236PinOpen(false);',
'          // External navigation may fail without rolling back the started ride.',
'          void launchApoisNavigationAfterRideStart(ride.destination_lat,ride.destination_lng)',
'            .catch(error=>{console.warn("[APOIS] Navegação do destino não abriu",error);',
'              toast.info("Corrida iniciada. Use Reabrir mapa para tentar novamente.");});',
'        }}/>',
'      )}'
].join("\n")+"\n";
const shell='      {/* ===== Corrida ativa =====';
if(s.split(shell).length!==2)throw Error("[FAIL] QA236 ride shell anchor");
s=s.replace(shell,modal+shell);

// In QA235 PickupNavOverlay's onArrive handler was dead code: delete only
// that exact callback, preserving cancellation and passenger actions.
const mount=s.indexOf("        <PickupNavOverlay");
const old=s.indexOf("          onArrive={async () => {",mount);
const stop=s.indexOf("          onCancel={async () => {",old);
if(mount<0||old<0||stop<=old||stop-old>1300)
 throw Error("[FAIL] QA236 former arrival callback boundary");
s=s.slice(0,old)+s.slice(stop);
const mount2=s.indexOf("        <PickupNavOverlay");
const closing=s.indexOf("        />",mount2);
const mountText=s.slice(mount2,closing);
const prop='          onOpenProfile={() => active.passenger_id && setProfilePassengerId(active.passenger_id)}';
if(mountText.split(prop).length!==2)throw Error("[FAIL] QA236 pickup profile prop");
s=s.slice(0,mount2)+mountText.replace(prop,prop+'\n          onStartPin={()=>setQa236PinOpen(true)}')+s.slice(closing);

for(const keep of [
 'data-apois-qa236-start-ride="true"','data-apois-qa236-pin-dialog', // PIN dialog in copied component, not route
 'onStartPin={()=>setQa236PinOpen(true)}',
 'await callStart({data:{rideId:ride.id,safety_code:code}})',
 'launchApoisNavigationAfterRideStart(ride.destination_lat,ride.destination_lng)',
 'onClick={onShowRoute}','onClick={onRecenter}',
 'data-apois-qa220-pin-digit-v1']){
 if(keep==='data-apois-qa236-pin-dialog')continue;
 if(!s.includes(keep))throw Error("[FAIL] QA236 missing "+keep);
}
if(s.includes("O passageiro será avisado automaticamente pelo GPS."))
 throw Error("[FAIL] QA236 obsolete notice");
writeFileSync(file,s,"utf8");
console.log("[OK] QA236: pickup PIN visible, one entry CTA, GPS + backend status confirmation, Google/Waze destination");
