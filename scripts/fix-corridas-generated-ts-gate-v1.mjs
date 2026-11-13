// GitHub Actions QA: retain mandatory TS checking on the generated Corridas copy.
// Only align types/JSX with already-existing contracts; no server, payment or map logic changes.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const MARK="APOIS_CORRIDAS_GENERATED_TYPECHECK_V1";
function once(s,before,after,label){
 const n=s.split(before).length-1;
 if(n!==1)throw Error("[TS-GATE] "+label+" anchors="+n);
 return s.replace(before,after);
}
function applyText(s,changes,label) {
 if(s.includes(MARK)) return s;
 let next=s;
 for(const [before,after,name] of changes)next=once(next,before,after,label+"/"+name);
 if(next===s)throw Error("[TS-GATE] "+label+" unchanged");
 return "// "+MARK+"\n"+next;
}
export function applyGeneratedCorridasTypecheck(root=process.cwd()){
 const dir=resolve(root,".work/corridas/src");
 const specs=[
 ["components/pricing/CategorySelector.tsx",[
   // QA238 keeps both singular and plural category identifiers from current/legacy APIs.
   // This is only a TypeScript noPropertyAccessFromIndexSignature compatibility fix.
   ['servicePosition.carros','servicePosition["carros"]',"sprite index-signature fallback"],
 ]],
 ["components/profile/PassengerAccountDeletion.tsx",[
   ['ref={deleteDialogRef}','ref={(element) => { deleteDialogRef.current = element; }}',"dialog ref type compatible with div"],
 ]],
 ["lib/useApoisDeletionDialogFocus.ts",[
   ['const first = focusable[0];','const first = focusable[0]!;',"focus length guard"],
   ['const last = focusable[focusable.length - 1];','const last = focusable[focusable.length - 1]!;',"last focus length guard"],
 ]],
 ["routes/_authenticated.corrida.$rideId.tsx",[
   ['isStatic={screenState === "completed" || screenState === "cancelled"}',
    'isStatic={screenState === "cancelled"}',"screenState completed already returned"],
   ['{(screenState === "completed" || screenState === "cancelled") && (',
    '{screenState === "cancelled" && (',"completed screen handled by early return"],
 ]],
 ["routes/_authenticated.inicio.tsx",[
   ['user?.user_metadata?.avatar_url','user?.user_metadata?.["avatar_url"]',"metadata index signature avatar"],
   ['user?.user_metadata?.picture','user?.user_metadata?.["picture"]',"metadata index signature picture"],
 ]],
 ["services/geocoding/geocoding-service.ts",[
   ['if (Array.isArray(part["types"]) &&\n          types.some((type) => part["types"].includes(type))) {',
    'const partTypes = part["types"];\n        if (Array.isArray(partTypes) &&\n          types.some((type) => partTypes.includes(type))) {',
    "narrow unknown field with same array guard"],
 ]],
 ["services/payments/payment-service.ts",[
   ['const directMethods = (data ?? []).flatMap((method) => {',
    'const directMethods: PaymentMethod[] = (data ?? []).flatMap((method) => {',
    "typed direct-payment list permits already typed fallback"],
 ]],
 ["services/rides/active-ride-service.ts",[
   ['const ACTIVE_STATUSES: RideStatus[] = [',
    'const ACTIVE_STATUSES: Array<Exclude<RideStatus, "expired">> = [',
    "terminal expired cannot be used in active ride database search"],
 ]],
 ];
 // The server can return expired; a string comparison must stay executable even
 // when the older generated ActiveRide input narrows that state prematurely.
 // This is a type-level compatibility adjustment, never a change of terminal behavior.
 // Profile fallback may use . or ?. after user_metadata; require both keys
 // and convert only their index-signature access (never the typed profile fields).
 const profileRel="routes/_authenticated.perfil.tsx";
 const profilePath=resolve(dir,profileRel);
 const profileBefore=readFileSync(profilePath,"utf8");
 let profileAfter=profileBefore;
 if(!profileBefore.includes(MARK)){
   let avatarCount=0, pictureCount=0;
   profileAfter=profileBefore.replace(/user_metadata(\?\.|\.)(avatar_url|picture)\b/g,
     (_,access,key)=>{
       if(key==="avatar_url")avatarCount++; else pictureCount++;
       return "user_metadata"+access+'["'+key+'"]';
     });
   if(avatarCount!==1 || pictureCount!==1)throw Error("[TS-GATE] profile metadata index signature drift "+avatarCount+"/"+pictureCount);
   profileAfter="// "+MARK+"\n"+profileAfter;
 }
 const hookRel="hooks/rides/use-active-ride.tsx";
 const hookPath=resolve(dir,hookRel);
 const hookBefore=readFileSync(hookPath,"utf8");
 let hookAfter=hookBefore;
 if(!hookBefore.includes(MARK)){
   let patched=0;
   hookAfter=hookBefore.replace(/\b(updatedRide|data|latestRide)\.status\s*(===|!==)\s*"expired"/g,
     (_, name, operator) => {
       patched++;
       return "String("+name+".status) "+operator+" \"expired\"";
     });
   // The terminal helper also receives legacy RideStatus typings. Compare the
   // actual incoming string, retaining the server-confirmed expired branch.
   const terminal="status === \"expired\" || status.startsWith(\"cancelada\")";
   if(hookAfter.split(terminal).length!==2)throw Error("[TS-GATE] terminal guard drift");
   hookAfter=hookAfter.replace(terminal,'String(status) === "expired" || status.startsWith("cancelada")');
   if(patched<1 || patched>5)throw Error("[TS-GATE] unexpected server-expired comparisons="+patched);
   hookAfter="// "+MARK+"\n"+hookAfter;
 }
 const plans=specs.map(([rel,changes])=>{
  const path=resolve(dir,rel),before=readFileSync(path,"utf8");
  const after=applyText(before,changes,rel);
  if(!after.includes(MARK))throw Error("[TS-GATE] no marker "+rel);
  if(applyText(after,changes,rel)!==after)throw Error("[TS-GATE] non-idempotent "+rel);
  return {rel,path,before,after};
 });
 plans.push({rel:profileRel,path:profilePath,before:profileBefore,after:profileAfter});
 plans.push({rel:hookRel,path:hookPath,before:hookBefore,after:hookAfter});
 for(const p of plans)if(p.before!==p.after)writeFileSync(p.path,p.after,"utf8");
 return plans.map(p=>p.rel);
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
 console.log("[OK] Corridas strict type contracts in disposable workspace",applyGeneratedCorridasTypecheck().join(", "));
