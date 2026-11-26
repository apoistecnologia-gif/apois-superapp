// Only the disposable QA290 Motorista workspace may be transformed.
// Preserve all historical backend operations and the external launch itself.
// No APK, plugin registration, real account access or provider deployment.
import {readFileSync,writeFileSync,realpathSync,mkdirSync,copyFileSync} from "node:fs";
import {join} from "node:path";
import {execFileSync} from "node:child_process";
import assert from "node:assert/strict";
const root=realpathSync(process.argv[2]),repo=realpathSync(process.argv[3]);
const temp=realpathSync(process.env.RUNNER_TEMP);
assert.equal(root,join(temp,"apois-qa290-web/.work/partner-motorista"));
const lib=join(root,"src/lib/apois-navigation-lab");
mkdirSync(lib);
for(const p of ["confirmed-navigation-launch.mjs","motorista-authority.mjs","driver-proof-reader.mjs"])
  copyFileSync(join(repo,"labs/apois-navigation/host-compat",p),join(lib,p));
execFileSync(process.execPath,["--test",join(repo,"labs/apois-navigation/host-compat/confirmed-navigation-launch.test.mjs")],{stdio:"inherit"});
execFileSync(process.execPath,["--test",join(repo,"labs/apois-navigation/host-compat/driver-proof-reader.test.mjs")],{stdio:"inherit"});
writeFileSync(join(lib,"driver-proof-reader.d.mts"),`
import type {ConfirmedLaunchProof,ConfirmedPhase} from "./confirmed-navigation-launch.mjs";
export function createDriverProofReader(options:{
 getSession:(signal:AbortSignal)=>Promise<{userId:string;token:string}|null>;
 getUser:(token:string,signal:AbortSignal)=>Promise<string|null>;
 readProfile:(signal:AbortSignal)=>Promise<{id:string;user_id:string}|null>;
 readRide:(id:string,signal:AbortSignal)=>Promise<ConfirmedLaunchProof["row"]|null>;
 timeoutMs?:number;maxPending?:number;
}):(r:{rideId:string;phase:ConfirmedPhase})=>Promise<ConfirmedLaunchProof|null>;
`,{flag:"wx"});
writeFileSync(join(lib,"confirmed-navigation-launch.d.mts"),`
export type ConfirmedPhase = "PICKUP" | "TRIP";
export type ConfirmedLaunchProof = {
  identity:{authUserId:string;driverId:string;profileUserId:string};
  row:{id:string;status:string;driver_id:string|null;accepted_driver_id:string|null;category:string};
};
type Request={rideId:string;phase:ConfirmedPhase};
type OpenResult={state:"opened";sessionId:string}|{state:"unavailable"};
export class ConfirmedNavigationLaunch {
  constructor(options:{enabled?:boolean;verify:(r:Request)=>Promise<ConfirmedLaunchProof|null>;
    openNative:(r:Request & {revision:number},current:()=>boolean)=>Promise<OpenResult>;
    cancelNativePreparation?:(r:Request & {revision:number})=>Promise<boolean>;
    closeNative:(sessionId:string)=>Promise<boolean>;prepareAudio?:()=>Promise<(()=>void)|null>;canOpenNative?:()=>Promise<boolean>});
  invalidate():Promise<boolean>;
  onNativeClosed(event:unknown):boolean;
  recheck():Promise<string>;
  observeRide(rideId:string|null,status:string|null):Promise<string>|undefined;
  launch(r:Request & {openExternal:()=>Promise<void>;allowExternalFallback?:boolean}):Promise<"external"|"internal"|"busy"|"stale"|"unverified"|"uncertain"|"unavailable">;
  runExternal<T>(work:()=>Promise<T>):Promise<T>;
}
`,{flag:"wx"});
writeFileSync(join(lib,"host.ts"),`// APOIS_NAVIGATION_QA290_CONFIRMED_HOST
import {supabase} from "@/integrations/supabase/client";
import {beginConfirmedVoiceHandoff} from "@/lib/voiceNav";
import {Capacitor,registerPlugin,type PluginListenerHandle} from "@capacitor/core";
import {ConfirmedNavigationLaunch,type ConfirmedPhase,type ConfirmedLaunchProof} from "./confirmed-navigation-launch.mjs";
import {createDriverProofReader} from "./driver-proof-reader.mjs";

// Hard disabled. Do not expose a preference, remote flag or deep link until
// the native adapter, provenance, revocation and physical QA are approved.
const EXPERIMENTAL_INTERNAL_NAVIGATION:boolean=false;

const verify=createDriverProofReader({
  getSession:async()=>{
    const {data,error}=await supabase.auth.getSession();
    return error||!data.session?null:{userId:data.session.user.id,token:data.session.access_token};
  },
  getUser:async token=>{
    const {data,error}=await supabase.auth.getUser(token);
    return error?null:data.user?.id??null;
  },
  readProfile:async signal=>{
    const profile=await supabase.rpc("driver_get_profile").abortSignal(signal);
    if(profile.error||!profile.data||typeof profile.data!=="object"||Array.isArray(profile.data))return null;
    const record=profile.data as Record<string,unknown>;
    return typeof record.id==="string"&&typeof record.user_id==="string"?{id:record.id,user_id:record.user_id}:null;
  },
  readRide:async (rideId,signal)=>{
    const result=await supabase.from("rides").select("id,status,driver_id,accepted_driver_id,category").eq("id",rideId).abortSignal(signal).maybeSingle();
    return result.error||!result.data?null:result.data as unknown as ConfirmedLaunchProof["row"];
  },
});

type ConfirmedRequest={rideId:string;phase:ConfirmedPhase;revision:number};
type ConfirmedNativePlugin={
  confirmedAvailability():Promise<{configured:boolean}>;
  openConfirmed(request:ConfirmedRequest):Promise<{state:"opened";sessionId:string}|{state:"unavailable"}>;
  closeConfirmed(request:{sessionId:string}):Promise<{closed:boolean}>;
  cancelConfirmedPreparation(request:ConfirmedRequest):Promise<{cancelled:boolean}>;
  addListener(eventName:"confirmedRideIntent",listener:(event:unknown)=>void):Promise<PluginListenerHandle>;
};
const nativeName="ApoisConfirmedNavigation";
const native=registerPlugin<ConfirmedNativePlugin>(nativeName);
let listenerReady:Promise<boolean>|null=null;
let listenerEpoch=0;
let listener:PluginListenerHandle|null=null;
function ensureNativeListener():Promise<boolean>{
  if(listener)return Promise.resolve(true);
  if(listenerReady)return listenerReady;
  const epoch=listenerEpoch;
  const pending=native.addListener("confirmedRideIntent",event=>{
    if(epoch===listenerEpoch)launch.onNativeClosed(event);
  }).then(async handle=>{
    if(epoch!==listenerEpoch){await handle.remove();return false;}
    listener=handle;return true;
  }).catch(()=>false);
  listenerReady=pending;
  void pending.finally(()=>{if(listenerReady===pending)listenerReady=null;});
  return pending;
}
const launch=new ConfirmedNavigationLaunch({
  enabled:EXPERIMENTAL_INTERNAL_NAVIGATION,verify,
  prepareAudio:beginConfirmedVoiceHandoff,
  canOpenNative:async()=>Capacitor.isNativePlatform()&&Capacitor.getPlatform()==="android"&&
    Capacitor.isPluginAvailable(nativeName)&&(await native.confirmedAvailability()).configured===true,
  openNative:async (request,current)=>{
    if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=="android"||
       !Capacitor.isPluginAvailable(nativeName))return {state:"unavailable"};
    if(!current()||!await ensureNativeListener()||!current())return {state:"unavailable"};
    // A rejection or malformed response is NOT proof of no Activity.
    // Pass it to the controller's ambiguity guard, never convert to fallback.
    return native.openConfirmed(request);
  },
  cancelNativePreparation:async request=>(await native.cancelConfirmedPreparation(request)).cancelled===true,
  closeNative:async sessionId=>(await native.closeConfirmed({sessionId})).closed===true,
});

export async function launchConfirmedApoisNavigation(rideId:string,phase:ConfirmedPhase,openExternal:()=>Promise<void>):Promise<void>{
  const result=await launch.launch({rideId,phase,openExternal});
  if(result!=="external"&&result!=="internal")throw Error("Navegação não confirmada. Confira a corrida e use Reabrir mapa.");
}

export function confirmedNavigationEnabled():boolean {
  return EXPERIMENTAL_INTERNAL_NAVIGATION&&Capacitor.isNativePlatform()&&Capacitor.getPlatform()==="android";
}
export async function retryConfirmedApoisNavigation(rideId:string,phase:ConfirmedPhase):Promise<string>{
  return launch.launch({rideId,phase,allowExternalFallback:false,openExternal:async()=>{throw Error("Explicit internal retry must not open external map");}});
}
export function runExternalApoisNavigation<T>(work:()=>Promise<T>):Promise<T>{
  return launch.runExternal(work);
}

// Attach only in the existing Motorista route. No extra auth subscription or
// data reads in the default mode. Invalidation never runs a ride operation.
export function bindConfirmedNavigationLifecycle():()=>void {
  if(!EXPERIMENTAL_INTERNAL_NAVIGATION)return ()=>{};
  let previous:string|null|undefined;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
    const current=session?.user.id??null;
    if(event==="SIGNED_OUT"||(previous!==undefined&&current!==previous))void launch.invalidate();
    previous=current;
  });
  // Poll only while the controller owns a native session.
  // Background WebView timers are best-effort, not a native authority lease.
  const timer=window.setInterval(()=>{void launch.recheck();},20000);
  return ()=>{
    subscription.unsubscribe();
    window.clearInterval(timer);
    ++listenerEpoch;
    const old=listener;
    listener=null;listenerReady=null;
    if(old)void old.remove().catch(()=>undefined);
    void launch.invalidate();
  };
}

export function observeConfirmedNavigationRide(rideId:string|null,status:string|null):void{
  if(EXPERIMENTAL_INTERNAL_NAVIGATION)void launch.observeRide(rideId,status);
}
`,{flag:"wx"});
writeFileSync(join(lib,"internal-retry.tsx"),"import {useEffect,useRef,useState} from \"react\";\nimport {confirmedNavigationEnabled,retryConfirmedApoisNavigation} from \"./host\";\nimport type {ConfirmedPhase} from \"./confirmed-navigation-launch.mjs\";\nexport function ConfirmedNavigationRetryButton({rideId,phase,category}:{rideId:string;phase:ConfirmedPhase;category:string|null|undefined}){\n const [busy,setBusy]=useState(false);\n const [message,setMessage]=useState(\"\");\n const current=useRef<object|null>(null);\n useEffect(()=>{current.current={};setBusy(false);setMessage(\"\");return()=>{current.current=null;};},[rideId,phase]);\n if(!confirmedNavigationEnabled()||category!==\"carros\")return null;\n async function retry(){\n  const ticket=current.current;\n  if(!ticket||busy)return;\n  setBusy(true);setMessage(\"\");\n  try{\n   const result=await retryConfirmedApoisNavigation(rideId,phase);\n   if(current.current!==ticket)return;\n   if(result===\"unavailable\")setMessage(\"Navegação APOIS indisponível. Você pode escolher Google Maps ou Waze.\");\n   else if(result===\"busy\"||result===\"uncertain\")setMessage(\"A navegação anterior ainda não foi encerrada. Confira antes de tentar novamente.\");\n   else if(result!==\"internal\")setMessage(\"Confira a corrida e a localização antes de tentar novamente.\");\n  }catch{if(current.current===ticket)setMessage(\"Não foi possível confirmar a navegação.\");}\n  finally{if(current.current===ticket)setBusy(false);}\n }\n return <div className=\"w-full min-w-0\">\n  <button type=\"button\" disabled={busy} onClick={()=>void retry()} className=\"flex min-h-[48px] w-full items-center justify-center rounded-[16px] border border-[#C71623] bg-white px-3 text-[13px] font-extrabold text-[#C71623] disabled:opacity-50\">\n   {busy?\"Verificando navegação…\":\"Navegação APOIS\"}\n  </button>\n  {message?<p role=\"status\" className=\"mt-1 text-xs font-semibold text-[#AF1830]\">{message}</p>:null}\n </div>;\n}\n",{flag:"wx"});
const appPath=join(root,"src/routes/motorista.app.tsx");
let app=readFileSync(appPath,"utf8");
const replaceExact=(a,b)=>{assert.equal(app.split(a).length,2,"QA290 host anchor: "+a);app=app.replace(a,()=>b);};
assert.ok(app.includes("APOIS_DRIVER_HOME_PREMIUM_V1")&&app.includes("APOIS_DRIVER_RIDE_VIDEO_AUDIT_V1"));
app='// APOIS_NAVIGATION_QA290_CONFIRMED_LAUNCH\nimport {ConfirmedNavigationRetryButton} from "@/lib/apois-navigation-lab/internal-retry";\nimport {launchConfirmedApoisNavigation,bindConfirmedNavigationLifecycle,observeConfirmedNavigationRide} from "@/lib/apois-navigation-lab/host";\n'+app;
replaceExact("function MotoristaApp() {","function MotoristaApp() {\n  useEffect(() => bindConfirmedNavigationLifecycle(), []);");
replaceExact("  const [active, setActive] = useState<RideRow | null>(null);",
  "  const [active, setActive] = useState<RideRow | null>(null);\n  useEffect(() => { observeConfirmedNavigationRide(active?.id ?? null,active?.status ?? null); }, [active?.id,active?.status]);");
const pickup="launchApoisNavigationAfterRideStart(accepted.origin_lat, accepted.origin_lng)";
replaceExact(pickup,'launchConfirmedApoisNavigation(accepted.id, "PICKUP", () => '+pickup+')');
const trip="launchApoisNavigationAfterRideStart(ride.destination_lat, ride.destination_lng)";
const tripCount=app.split(trip).length-1;
assert.ok(tripCount>=1&&tripCount<=2,"unexpected QA290 destination launch count "+tripCount);
app=app.replaceAll(trip,()=> 'launchConfirmedApoisNavigation(ride.id, "TRIP", () => '+trip+')');
// Keep external provider selection and original UI. The new explicit button
// is absent in default builds; it never silently opens a different app.
for(const [anchor,phase] of [
 ['<ApoisExternalNavigation latitude={ride.origin_lat} longitude={ride.origin_lng} stage="até o passageiro" />',"PICKUP"],
 ['<ApoisExternalNavigation latitude={ride.destination_lat} longitude={ride.destination_lng} stage="até o destino" />',"TRIP"]
]){
 replaceExact(anchor,anchor+'\n          <ConfirmedNavigationRetryButton rideId={ride.id} phase="'+phase+'" category={ride.category} />');
}
// The original external callback stays available and existing PIN, finish,
// cancellation and visual markers are never rewritten by this transform.
assert.equal(app.split(pickup).length-1,1);
assert.equal(app.split(trip).length-1,tripCount);
writeFileSync(appPath,app);
console.log("[OK] QA290 confirmed-navigation host attached: pickup=1 destination="+tripCount+"; hard disabled; external callback unchanged; native transport connected, live provider unavailable, no production registration");
