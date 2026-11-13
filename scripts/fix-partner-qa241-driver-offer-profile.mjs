// QA241: generated Motorista only. Do not change protected source or production RLS.
// A missing legacy get_passenger_public_profile RPC caused permanent skeleton in video.
import {copyFileSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista");
const file=resolve(root,"src/routes/motorista.app.tsx");
const target=resolve(root,"src/components/ApoisDriverOfferPassengerProfile.tsx");
let s=readFileSync(file,"utf8");
function one(before,after,label){
 const n=s.split(before).length-1;if(n!==1)throw Error("[QA241] "+label+" anchors="+n);
 s=s.replace(before,after);
}
one('import { PassengerProfessionalProfileDialog } from "@/components/profile/PassengerProfessionalProfileDialog";',
 'import { ApoisDriverOfferPassengerProfile } from "@/components/ApoisDriverOfferPassengerProfile";',
 "passenger modal import");
one('onOpenProfile={() => incoming.passenger_id && setProfilePassengerId(incoming.passenger_id)}',
 'onOpenProfile={() => incoming.id && setProfilePassengerId(incoming.id)}',
 "scope profile to the offered ride, not user's account id");
one('<PassengerProfessionalProfileDialog\n        open={profilePassengerId !== null}\n        onOpenChange={(v) => { if (!v) setProfilePassengerId(null); }}\n        passengerUserId={profilePassengerId}\n      />',
 '<ApoisDriverOfferPassengerProfile\n        open={profilePassengerId !== null}\n        onOpenChange={(v) => { if (!v) setProfilePassengerId(null); }}\n        rideId={profilePassengerId}\n        initial={passenger}\n      />',
 "offer profile dialog instance");
for(const t of ['onAccept={handleAccept}','onReject={handleReject}','onStartPin={()=>setQa236PinOpen(true)}','onConfirm={handleComplete}'])
 if(!s.includes(t))throw Error("[QA241] preserved driver flow "+t);
copyFileSync(resolve("superapp/partner-shell/shared/ApoisDriverOfferPassengerProfile.tsx"),target);
writeFileSync(file,s,"utf8");
console.log("[OK] QA241: passenger profile uses existing ride-authorized offer RPC and finite loading fallback.");
