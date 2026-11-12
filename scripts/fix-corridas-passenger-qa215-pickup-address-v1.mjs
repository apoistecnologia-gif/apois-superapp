// APOIS_PASSENGER_QA215_PICKUP_BACKOFF_V1
// Evidence: Android 211806.mp4; after completed ride, home address flips
// "Identificando seu endereço..." <-> "Endereço indisponível" on GPS ticks.
// APPLY ONLY to isolated .work/corridas, NEVER protected source or production.
// Preserve google-maps-address Edge Function, auth/RLS, payment and ride flows.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const path=resolve(root,"src/hooks/use-pickup-address.tsx");
let s=readFileSync(path,"utf8");
const marker="APOIS_PASSENGER_QA215_PICKUP_BACKOFF_V1";
if(s.includes(marker))throw Error("[FAIL] QA215 duplicate pickup patch");
function one(from,to,why) {
  const count=s.split(from).length-1;
  if(count!==1)throw Error("[FAIL] QA215 "+why+" anchors="+count);
  s=s.replace(from,to);
}
const refAnchor="  const addressKnownRef = useRef(false);";
one(refAnchor,refAnchor+"\n"+[
  "  // "+marker+": bounded reverse-geocoding; manual retries stay available.",
  "  const lastAttemptRef = useRef<{latitude:number;longitude:number;at:number}|null>(null);",
  "  const distanceMeters = (a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}) =>",
  "    Math.hypot((a.latitude-b.latitude)*111320,",
  "      (a.longitude-b.longitude)*111320*Math.cos(b.latitude*Math.PI/180));",
].join("\n"),"new attempt state");
one("  const refreshAddress = useCallback(async () => {",
    "  const refreshAddress = useCallback(async (force = true) => {",
    "allow explicit/manual retry");
const start=s.indexOf("  const refreshAddress = useCallback(async (force = true) => {");
const end=s.indexOf("  useEffect(() => {",start);
if(start<0||end<=start)throw Error("[FAIL] QA215 callback shape changed");
let block=s.slice(start,end);
const guardStart=block.indexOf("    const previous = lastGeocodeRef.current;");
const guardEnd=block.indexOf("    geocodeBusyRef.current = true;",guardStart);
if(guardStart<0||guardEnd<=guardStart)throw Error("[FAIL] QA215 original 85m guard absent");
const guard=[
 "    const now = Date.now();",
 "    const previous = lastGeocodeRef.current;",
 "    const movedFromSuccess = previous ? distanceMeters(previous,location) : Infinity;",
 "    // Drop a location label immediately if the passenger has moved far from it.",
 "    if (previous && movedFromSuccess >= 120) {",
 "      lastGeocodeRef.current = null;",
 "      addressKnownRef.current = false;",
 "      setAddress(null); setPickupLabel(null); setPickupShortLabel(null);",
 '      setError("Aguardando identificação do endereço nesta posição.");',
 '      setStatus("error");',
 "    }",
 "    // A confirmed nearby street does not need another billed lookup per GPS tick.",
 "    if (!force && movedFromSuccess < 85) return;",
 "    const lastAttempt = lastAttemptRef.current;",
 "    const attemptMeters = lastAttempt ? distanceMeters(lastAttempt,location) : Infinity;",
 "    const elapsed = lastAttempt ? now-lastAttempt.at : Infinity;",
 "    if (!force && lastAttempt && elapsed < 20000) return;",
 "    if (!force && lastAttempt && elapsed < 60000 && attemptMeters < 120 && !previous) return;",
 "    lastAttemptRef.current={latitude:location.latitude,longitude:location.longitude,at:now};",
].join("\n")+"\n";
block=block.slice(0,guardStart)+guard+block.slice(guardEnd);
const catchAnchor='      if (!addressKnownRef.current) setAddress(null);';
if(block.split(catchAnchor).length!==2)throw Error("[FAIL] QA215 catch hook anchor missing");
block=block.replace(catchAnchor,
 '      if (!addressKnownRef.current) { setAddress(null); setPickupLabel(null); setPickupShortLabel(null); }');
if(!block.includes("action: \"reverse_geocode\"")||
 !block.includes("\"google-maps-address\"")||
 !block.includes("lastGeocodeRef.current = { latitude: location.latitude, longitude: location.longitude }")||
 !block.includes("geocodeBusyRef.current = false;"))
 throw Error("[FAIL] QA215 deployed geocoding/cleanup contract changed");
s=s.slice(0,start)+block+s.slice(end);
const autoEffect='    if (location) {\n      refreshAddress();\n    }';
one(autoEffect,'    if (location) {\n      void refreshAddress(false); // GPS watches obey cooldown and distance gate.\n    }',
  "GPS watch must not request manual force");
for(const token of [
 marker,"lastAttemptRef","elapsed < 20000","elapsed < 60000",
 "movedFromSuccess < 85","movedFromSuccess >= 120",
 "void refreshAddress(false)","action: \"reverse_geocode\"",
 "setPickupLabel(null); setPickupShortLabel(null)"
])if(!s.includes(token))throw Error("[FAIL] QA215 lost "+token);
writeFileSync(path,s,"utf8");
console.log("[OK] QA215 pickup: retry-on-tap; automatic requests rate-limited; keep nearby confirmed address; clear stale location label.");
