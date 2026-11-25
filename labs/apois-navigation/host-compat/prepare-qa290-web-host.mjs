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
for(const p of ["confirmed-navigation-launch.mjs","motorista-authority.mjs"])
  copyFileSync(join(repo,"labs/apois-navigation/host-compat",p),join(lib,p));
execFileSync(process.execPath,["--test",join(repo,"labs/apois-navigation/host-compat/confirmed-navigation-launch.test.mjs")],{stdio:"inherit"});
writeFileSync(join(lib,"confirmed-navigation-launch.d.mts"),`
export type ConfirmedPhase = "PICKUP" | "TRIP";
export type ConfirmedLaunchProof = {
  identity:{authUserId:string;driverId:string;profileUserId:string};
  row:{id:string;status:string;driver_id:string|null;accepted_driver_id:string|null};
};
type Request={rideId:string;phase:ConfirmedPhase};
type OpenResult={state:"opened";sessionId:string}|{state:"unavailable"};
export class ConfirmedNavigationLaunch {
  constructor(options:{enabled?:boolean;verify:(r:Request)=>Promise<ConfirmedLaunchProof|null>;
    openNative:(r:Request & {revision:number})=>Promise<OpenResult>;
    closeNative:(sessionId:string)=>Promise<boolean>});
  invalidate():Promise<boolean>;
  launch(r:Request & {openExternal:()=>Promise<void>}):Promise<"external"|"internal"|"busy"|"stale"|"unverified"|"uncertain">;
}
`,{flag:"wx"});
writeFileSync(join(lib,"host.ts"),`// APOIS_NAVIGATION_QA290_CONFIRMED_HOST
import {supabase} from "@/integrations/supabase/client";
import {Capacitor,registerPlugin} from "@capacitor/core";
import {ConfirmedNavigationLaunch,type ConfirmedPhase,type ConfirmedLaunchProof} from "./confirmed-navigation-launch.mjs";

// Hard disabled. Do not expose a preference, remote flag or deep link until
// the native adapter, provenance, revocation and physical QA are approved.
const EXPERIMENTAL_INTERNAL_NAVIGATION:boolean=false;

async function verify({rideId}: {rideId:string;phase:ConfirmedPhase}):Promise<ConfirmedLaunchProof|null> {
  const before=await supabase.auth.getUser();
  const authId=before.data.user?.id;
  if(before.error||!authId)return null;
  // Existing read-only profile RPC. Do not call a profile helper that could
  // trigger unrelated provisioning. No auth/user equality assumptions.
  const profile=await supabase.rpc("driver_get_profile");
  if(profile.error||!profile.data||typeof profile.data!=="object"||Array.isArray(profile.data))return null;
  const record=profile.data as Record<string,unknown>;
  if(typeof record.id!=="string"||typeof record.user_id!=="string")return null;
  const result=await supabase.from("rides")
    .select("id,status,driver_id,accepted_driver_id").eq("id",rideId).maybeSingle();
  if(result.error||!result.data)return null;
  const after=await supabase.auth.getUser();
  if(after.error||after.data.user?.id!==authId)return null;
  return {identity:{authUserId:authId,driverId:record.id,profileUserId:record.user_id},
    row:result.data as unknown as ConfirmedLaunchProof["row"]};
}

type ConfirmedRequest={rideId:string;phase:ConfirmedPhase;revision:number};
type ConfirmedNativePlugin={
  openConfirmed(request:ConfirmedRequest):Promise<{state:"opened";sessionId:string}|{state:"unavailable"}>;
  closeConfirmed(request:{sessionId:string}):Promise<{closed:boolean}>;
};
const nativeName="ApoisNavigationLab";
const native=registerPlugin<ConfirmedNativePlugin>(nativeName);
const launch=new ConfirmedNavigationLaunch({
  enabled:EXPERIMENTAL_INTERNAL_NAVIGATION,verify,
  openNative:async request=>{
    if(!Capacitor.isNativePlatform()||Capacitor.getPlatform()!=="android"||
       !Capacitor.isPluginAvailable(nativeName))return {state:"unavailable"};
    // A rejection or malformed response is NOT proof of no Activity.
    // Pass it to the controller's ambiguity guard, never convert to fallback.
    return native.openConfirmed(request);
  },
  closeNative:async sessionId=>(await native.closeConfirmed({sessionId})).closed===true,
});

export async function launchConfirmedApoisNavigation(rideId:string,phase:ConfirmedPhase,openExternal:()=>Promise<void>):Promise<void>{
  const result=await launch.launch({rideId,phase,openExternal});
  if(result!=="external"&&result!=="internal")throw Error("Navegação não confirmada. Confira a corrida e use Reabrir mapa.");
}

// Attach only in the existing Motorista route. No extra auth subscription or
// data reads in the default mode. Invalidation never runs a ride operation.
export function bindConfirmedNavigationLifecycle():()=>void {
  if(!EXPERIMENTAL_INTERNAL_NAVIGATION)return ()=>{};
  let previous:string|null=null;
  const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
    const current=session?.user.id??null;
    if(event==="SIGNED_OUT"||current!==previous){previous=current;void launch.invalidate();}
  });
  return ()=>{subscription.unsubscribe();void launch.invalidate();};
}
`,{flag:"wx"});
const appPath=join(root,"src/routes/motorista.app.tsx");
let app=readFileSync(appPath,"utf8");
const replaceExact=(a,b)=>{assert.equal(app.split(a).length,2,"QA290 host anchor: "+a);app=app.replace(a,()=>b);};
assert.ok(app.includes("APOIS_DRIVER_HOME_PREMIUM_V1")&&app.includes("APOIS_DRIVER_RIDE_VIDEO_AUDIT_V1"));
app='// APOIS_NAVIGATION_QA290_CONFIRMED_LAUNCH\nimport {launchConfirmedApoisNavigation,bindConfirmedNavigationLifecycle} from "@/lib/apois-navigation-lab/host";\n'+app;
replaceExact("function MotoristaApp() {","function MotoristaApp() {\n  useEffect(() => bindConfirmedNavigationLifecycle(), []);");
const pickup="launchApoisNavigationAfterRideStart(accepted.origin_lat, accepted.origin_lng)";
replaceExact(pickup,'launchConfirmedApoisNavigation(accepted.id, "PICKUP", () => '+pickup+')');
const trip="launchApoisNavigationAfterRideStart(ride.destination_lat, ride.destination_lng)";
const tripCount=app.split(trip).length-1;
assert.ok(tripCount>=1&&tripCount<=2,"unexpected QA290 destination launch count "+tripCount);
app=app.replaceAll(trip,()=> 'launchConfirmedApoisNavigation(ride.id, "TRIP", () => '+trip+')');
// The original external callback stays available and existing PIN, finish,
// cancellation and visual markers are never rewritten by this transform.
assert.equal(app.split(pickup).length-1,1);
assert.equal(app.split(trip).length-1,tripCount);
writeFileSync(appPath,app);
console.log("[OK] QA290 confirmed-navigation host attached: pickup=1 destination="+tripCount+"; hard disabled; external callback unchanged; native transport connected, live provider unavailable, no production registration");
