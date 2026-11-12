// APOIS_NATIVE_GEOCODER_FAST_RACE_V1 — Prefer the first valid address from
// the unchanged Supabase request or Android OS. No additional paid API calls.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const hook=resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas","src/hooks/use-pickup-address.tsx");
let s=readFileSync(hook,"utf8");
const marker="APOIS_NATIVE_GEOCODER_FAST_RACE_V1";
if(s.includes(marker)){console.log("[OK] Android address race already present");process.exit(0)}
if(!s.includes("APOIS_NATIVE_GEOCODER_RECOVERY_V1") ||
   !s.includes('registerPlugin<APOISNativeGeocoder>("APOISNativeGeocoder")')) throw Error("[FAIL] Required working native fallback absent");
const before=`      const result = await Promise.race([
        reverseRequest,
        new Promise<never>((_, reject) => {`;
const after=`      // ${marker}: run the native lookup beside the existing backend request.
      // On a fast Android response, reuse the unchanged result validation/UI.
      // When Android is unavailable, the original server response still wins.
      const nativeLookup = Capacitor.isNativePlatform()
        ? apoisNativeGeocoder.reverse({ lat: location.latitude, lng: location.longitude })
            .then((nativeResult) => {
              const address = typeof nativeResult?.address === "string" ? nativeResult.address.trim() : "";
              if (!address) throw new Error("android_geocoder_empty");
              return { data: { results: [{ formatted_address: address, address_components: [] }] }, error: null };
            })
            .catch(() => new Promise<never>(() => {}))
        : new Promise<never>(() => {});
      const result = await Promise.race([
        reverseRequest,
        nativeLookup,
        new Promise<never>((_, reject) => {`;
if(s.split(before).length!==2)throw Error("[FAIL] Bounded Supabase request shape has changed");
s=s.replace(before,after);
for(const required of [marker,"nativeLookup,","reverseRequest,","12000","geocodeBusyRef.current = false;","runningCell.current = false;","APOIS_PASSENGER_QA215_PICKUP_BACKOFF_V1"]){
 if(!s.includes(required))throw Error("[FAIL] Recovery protection lost: "+required)
}
writeFileSync(hook,s,"utf8");
console.log("[OK] APOIS Cliente: concurrent Android OS and existing Supabase lookup; first successful address wins when OS is quicker.");
