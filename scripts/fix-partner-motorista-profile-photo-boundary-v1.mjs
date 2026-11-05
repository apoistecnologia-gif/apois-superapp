// UI-05: do not expose KYC selfie as a profile portrait.
import { readFileSync,writeFileSync } from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista","src/components/DriverSideMenu.tsx");
let source=readFileSync(file,"utf8");
const replace=(a,b,label)=>{const n=source.split(a).length-1;if(n!==1)throw Error("[FAIL] Avatar "+label+": "+n);source=source.replace(a,b)};
replace('import { refreshProfilePhotoUrl } from "@/lib/profilePhoto";',
'import { loadOwnProfilePhotoUrl, refreshProfilePhotoUrl } from "@/lib/profilePhoto";',"library import");
const original=`          const storedPhoto = String(profileResult.profile.photo_url ?? "").trim() ||
            String(profileResult.profile.selfie_url ?? "").trim();
          if (!storedPhoto) {
            setPhotoUrl(null);
          } else if (/^https?:\\/\\//i.test(storedPhoto)) {
            setPhotoUrl(storedPhoto);
          } else {
            const refreshed = await refreshProfilePhotoUrl(storedPhoto);
            if (!cancelled) setPhotoUrl(refreshed ?? null);
          }`;
const updated=`          // APOIS_DRIVER_PROFILE_PHOTO_ONLY_V1: verification selfie is private KYC data.
          // Use only the dedicated profile portrait; fall back to the same resolver as Perfil.
          const storedPhoto = String(profileResult.profile.photo_url ?? "").trim();
          const resolved = storedPhoto
            ? (/^https:\\/\\//i.test(storedPhoto) ? storedPhoto : await refreshProfilePhotoUrl(storedPhoto))
            : await loadOwnProfilePhotoUrl();
          if (!cancelled) setPhotoUrl(resolved && /^https:\\/\\//i.test(resolved) ? resolved : null);`;
replace(original,updated,"avatar photo resolver");
if(source.includes('String(profileResult.profile.selfie_url ?? "").trim()'))throw Error("KYC selfie fallback remains");
writeFileSync(file,source,"utf8");
console.log("[OK] Driver menu public avatar never falls back to private KYC selfie.");
