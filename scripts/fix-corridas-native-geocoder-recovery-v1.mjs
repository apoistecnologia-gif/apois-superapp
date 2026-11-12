// APOIS_NATIVE_GEOCODER_RECOVERY_V1 — fallback on the passenger's own Android
// device after backend 5xx/network failures. Never changes Supabase, GPS,
 // payment, maps credentials, or the protected pinned Corridas source.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const path = resolve(root, "src/hooks/use-pickup-address.tsx");
let source = readFileSync(path, "utf8");
const marker = "APOIS_NATIVE_GEOCODER_RECOVERY_V1";
if (source.includes(marker)) {
  console.log("[OK] Native geocoder recovery already installed");
  process.exit(0);
}
const from = 'import { supabase } from "@/integrations/supabase/client";';
if (source.split(from).length !== 2) throw Error("[FAIL] Reverse geocoder Supabase import is missing/ambiguous");
source = source.replace(from, from + '\nimport { Capacitor, registerPlugin } from "@capacitor/core";');
const context = "const PickupAddressContext = createContext<PickupAddressContextType | undefined>(undefined);";
if (source.split(context).length !== 2) throw Error("[FAIL] Pickup context has changed");
const nativeDeclaration = `
// ${marker}: Android Geocoder returns only actual OS-resolved street/locality.
type APOISNativeGeocoder = {
  reverse(input: { lat: number; lng: number }): Promise<{
    address: string;
    shortLabel?: string;
    approximate?: boolean;
  }>;
};
const apoisNativeGeocoder = registerPlugin<APOISNativeGeocoder>("APOISNativeGeocoder");
`;
source = source.replace(context, nativeDeclaration + "\n" + context);
const catchHead = "    } catch (err: any) {\n";
const start = source.indexOf(catchHead);
if (start < 0 || source.indexOf(catchHead, start + 1) >= 0) throw Error("[FAIL] Pickup catch block is missing/ambiguous");
const end = source.indexOf("    } finally {", start + catchHead.length);
if (end <= start) throw Error("[FAIL] Pickup finally block is missing");
const originalCatch = source.slice(start + catchHead.length, end);
for (const required of [
  'setStatus(addressKnownRef.current ? "success" : "error");',
  'setAddress(null)',
]) if (!originalCatch.includes(required)) throw Error("[FAIL] Existing catch protection changed: " + required);
const fallback = `    } catch (err: any) {
      // ${marker}: do not lose a valid GPS pickup when server-side
      // geocoding lacks its key or public Photon is unavailable.
      let nativeRecovered = false;
      if (Capacitor.isNativePlatform() && location &&
          Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
        try {
          let timer: ReturnType<typeof setTimeout> | undefined;
          const nativeResult = await Promise.race([
            apoisNativeGeocoder.reverse({ lat: location.latitude, lng: location.longitude }),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error("android_geocoder_timeout")), 4200);
            }),
          ]).finally(() => { if (timer) clearTimeout(timer); });
          const verifiedAddress = typeof nativeResult?.address === "string"
            ? nativeResult.address.trim() : "";
          if (!verifiedAddress) throw new Error("android_geocoder_empty");
          const shortLabel = typeof nativeResult.shortLabel === "string" && nativeResult.shortLabel.trim()
            ? nativeResult.shortLabel.trim() : verifiedAddress.split(",")[0]?.trim() || verifiedAddress;
          lastGeocodeRef.current = { latitude: location.latitude, longitude: location.longitude };
          addressKnownRef.current = true;
          setAddress(verifiedAddress);
          setPickupLabel(verifiedAddress);
          setPickupShortLabel(shortLabel);
          setError(null);
          setStatus("success");
          nativeRecovered = true;
        } catch (nativeError) {
          if (import.meta.env.DEV) console.warn("[pickup] Native Android geocoding unavailable", nativeError);
        }
      }
      if (!nativeRecovered) {
`;
const closing = "      }\n";
source = source.slice(0, start) + fallback
  + originalCatch.split("\n").map(line => line ? "  " + line : line).join("\n")
  + closing + source.slice(end);
const requiredTokens = [
 marker, 'apoisNativeGeocoder.reverse({ lat: location.latitude, lng: location.longitude })',
 'addressKnownRef.current = true;', 'setPickupLabel(verifiedAddress);',
 'setStatus("success");', 'if (!nativeRecovered) {',
 'setStatus(addressKnownRef.current ? "success" : "error");',
 'geocodeBusyRef.current = false;', 'runningCell.current = false;',
];
for (const token of requiredTokens) if (!source.includes(token)) throw Error("[FAIL] Native recovery lost protection " + token);
writeFileSync(path, source, "utf8");
console.log("[OK] APOIS Corridas passenger: native Android reverse-geocoding recovery installed without third-party API.");
