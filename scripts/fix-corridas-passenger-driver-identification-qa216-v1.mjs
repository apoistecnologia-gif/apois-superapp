// APOIS_PASSENGER_DRIVER_ID_QA216_V1
// DriverCard/VehicleCard already display live ride name/model/color/plate.
// The backend stores private profile-photos paths, not public image URLs.
// Resolve a short-lived signed URL when permitted by the existing RLS; on
// denial show the original icon instead of a broken <img>. No RLS changes.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const path=resolve(root,"src/components/rides/active/DriverCard.tsx");
let s=readFileSync(path,"utf8");
function once(a,b,label){
 const count=s.split(a).length-1;
 if(count!==1)throw Error("[FAIL] QA216 DriverCard "+label+" count="+count);
 s=s.replace(a,b);
}
if(s.includes("APOIS_PASSENGER_DRIVER_ID_QA216_V1"))throw Error("[FAIL] DriverCard duplicated");
once('import { ActiveRide } from "@/types/rides/active-ride";',
     'import { useEffect, useState } from "react";\nimport { supabase } from "@/integrations/supabase/client";\nimport { ActiveRide } from "@/types/rides/active-ride";',
     'stable ride type import');
once(
 'export const DriverCard: React.FC<DriverCardProps> = ({ ride }) => {\n  if (!ride.driver_id && !ride.driver_name) return null;',
 `export const DriverCard: React.FC<DriverCardProps> = ({ ride }) => {
  // APOIS_PASSENGER_DRIVER_ID_QA216_V1: private path is not a browser img URL.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const value = (ride.driver_photo ?? "").trim();
    setPhotoUrl(null);
    if (!value) return () => { mounted = false; };
    if (/^https:\\/\\//i.test(value)) {
      setPhotoUrl(value);
      return () => { mounted = false; };
    }
    void supabase.storage.from("profile-photos").createSignedUrl(value, 3600)
      .then(({ data, error }) => {
        if (mounted) setPhotoUrl(error ? null : (data?.signedUrl ?? null));
      })
      .catch(() => { if (mounted) setPhotoUrl(null); });
    return () => { mounted = false; };
  }, [ride.driver_photo]);
  if (!ride.driver_id && !ride.driver_name) return null;`,
 'photo resolution');
once('{ride.driver_photo ? (','{photoUrl ? (','conditional');
once('src={ride.driver_photo}\n          alt={ride.driver_name}',
     'src={photoUrl}\n          onError={() => setPhotoUrl(null)}\n          alt={ride.driver_name || "Foto do motorista"}',
     'private image');
for(const marker of [
 'APOIS_PASSENGER_DRIVER_ID_QA216_V1','createSignedUrl(value, 3600)',
 'ride.driver_name || "Motorista"','photoUrl ? (',
 'onError={() => setPhotoUrl(null)}','ride.driver_rating','ride.driver_phone'
])if(!s.includes(marker))throw Error("[FAIL] QA216 DriverCard missing "+marker);
const vehicle=readFileSync(resolve(root,"src/components/rides/active/VehicleCard.tsx"),"utf8");
for(const marker of ['ride.driver_vehicle_model','ride.driver_vehicle_color','ride.driver_vehicle_plate','Confira a placa'])
 if(!vehicle.includes(marker))throw Error("[FAIL] QA216 existing vehicle details missing "+marker);
writeFileSync(path,s,"utf8");
console.log("[OK] QA216: signed driver photo when authorized; driver name and vehicle identification preserved.");
