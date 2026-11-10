// APOIS_DRIVER_PASSENGER_AVATAR_V1 — represent missing passenger photo honestly.
// If no passenger name is available under current RLS, Avatar renders its
// person icon instead of a misleading letter "P". No cross-user data access.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/routes/motorista.app.tsx");
let src=readFileSync(file,"utf8");
if(src.includes("APOIS_DRIVER_PASSENGER_AVATAR_V1"))throw Error("[FAIL] Avatar patch applied twice");
const old='name={passenger?.name ?? "Passageiro"}';
const count=src.split(old).length-1;
if(count<4||count>12)throw Error("[FAIL] Passenger avatar usages changed "+count);
src=src.replaceAll(old,'name={passenger?.name ?? ""}');
const anchor="type Passenger = {";
if(src.split(anchor).length!==2)throw Error("[FAIL] Passenger data shape drift");
src=src.replace(anchor,"// APOIS_DRIVER_PASSENGER_AVATAR_V1: missing photo/name displays person icon, never invented personal data.\n"+anchor);
if(src.includes(old)||!src.includes('name={passenger?.name ?? ""}'))
  throw Error("[FAIL] Generic letter P persisted");
writeFileSync(file,src,"utf8");
console.log("[OK] Motorista: "+count+" passenger avatars use genuine name initial or person icon (no fake P/photo).");
