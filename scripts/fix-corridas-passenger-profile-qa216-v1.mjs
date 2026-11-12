// APOIS_PASSENGER_PROFILE_QA216_V1
// Fix only the disposable Corridas workspace after all existing profile/auth
// hardeners. Keep the pinned source, profile editor, Google login, wallet and
// database schema unchanged. Reuse existing private profile-photos/RLS.
import {copyFileSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, resolve} from "node:path";

const root = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const target = resolve(root,"src/routes/_authenticated.perfil.tsx");
let source = readFileSync(target,"utf8");
function replaceOnce(before,after,label){
  const count=source.split(before).length-1;
  if(count!==1)throw Error("[FAIL] QA216 Perfil "+label+" count="+count);
  source=source.replace(before,after);
}
if(source.includes("APOIS_PASSENGER_PROFILE_QA216_V1"))throw Error("[FAIL] QA216 already applied");
for(const marker of [
 'APOIS_CLIENT_PROFILE_EDIT_V1',
 'APOIS_CLIENT_ACCOUNT_DELETION_V1',
 '<Avatar className=',
 'AvatarImage src={',
 '{currentProfile.completedRides} corridas',
 'onSaved={refreshSession}',
]){
 if(!source.includes(marker))throw Error("[FAIL] QA216 Perfil missing prerequisite "+marker);
}
// The isolated build does not necessarily run the optional legacy profile UI
// hardener. Resolve the authenticated Google avatar fallback here if absent.
if(!source.includes("const profileAvatarUrl =")){
  replaceOnce(
    '  const currentProfile = normalizeProfile(profile, user?.email);',
    '  const currentProfile = normalizeProfile(profile, user?.email);\\n  const profileAvatarUrl = currentProfile.avatarUrl ?? readNonEmptyString(user?.user_metadata?.avatar_url) ?? readNonEmptyString(user?.user_metadata?.picture);',
    "profile avatar source"
  );
}
replaceOnce(
 'import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";',
 'import { PassengerProfilePhoto } from "@/components/profile/PassengerProfilePhoto";\nimport { PassengerCompletedRideCount } from "@/components/profile/PassengerCompletedRideCount"; // APOIS_PASSENGER_PROFILE_QA216_V1',
 "avatar imports"
);
const start=source.indexOf('<Avatar className=');
const end=start<0 ? -1 : source.indexOf('</Avatar>',start);
if(start<0||end<0||source.indexOf('<Avatar className=',end)>=0)
 throw Error("[FAIL] QA216 Perfil avatar region changed");
const oldAvatar=source.slice(start,end+'</Avatar>'.length);
if(!oldAvatar.includes('AvatarImage src={')||!oldAvatar.includes('AvatarFallback'))
 throw Error("[FAIL] QA216 Perfil avatar source/placeholder not found");
source=source.slice(0,start)+
 '<PassengerProfilePhoto avatarSource={profileAvatarUrl} name={currentProfile.name}\n          authUserId={user?.id} profileId={profile?.id} onSaved={refreshSession} />'+
 source.slice(end+'</Avatar>'.length);
replaceOnce(
 '{currentProfile.completedRides} corridas',
 '<PassengerCompletedRideCount passengerId={profile?.id ?? null} />',
 "actual server-completed rides"
);
for(const [template, output] of [
 ['scripts/templates/PassengerProfilePhoto.tsx','src/components/profile/PassengerProfilePhoto.tsx'],
 ['scripts/templates/PassengerCompletedRideCount.tsx','src/components/profile/PassengerCompletedRideCount.tsx'],
]){
 const full=resolve(root,output);
 mkdirSync(dirname(full),{recursive:true});
 copyFileSync(resolve(template),full);
}
for(const mark of [
 'APOIS_PASSENGER_PROFILE_QA216_V1',
 '<PassengerProfilePhoto avatarSource={profileAvatarUrl}',
 'profileId={profile?.id}',
 'onSaved={refreshSession}',
 '<PassengerCompletedRideCount passengerId={profile?.id ?? null} />',
 'PassengerAccountDeletion',
 'PassengerProfileEditor',
])if(!source.includes(mark))throw Error("[FAIL] QA216 Perfil missing "+mark);
writeFileSync(target,source,"utf8");
console.log("[OK] QA216 Passenger: own photo upload/sign and read-only finalized rides count, existing profile actions unchanged.");
