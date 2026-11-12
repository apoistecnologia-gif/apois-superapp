import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/hooks/use-pickup-address.tsx");
const s=readFileSync(file,"utf8");
test("QA215 GPS polling never repeats reverse-geocode every second after an error",()=>{
 for(const term of ["APOIS_PASSENGER_QA215_PICKUP_BACKOFF_V1",
 "const refreshAddress = useCallback(async (force = true) => {",
 "const lastAttemptRef = useRef<",
 "elapsed < 20000","elapsed < 60000","attemptMeters < 120",
 "void refreshAddress(false);","if (geocodeBusyRef.current) return;",
 "geocodeBusyRef.current = false;"])assert.ok(s.includes(term),term);
 assert.equal(s.split("action: \"reverse_geocode\"").length-1,1);
 assert.ok(!s.includes("if (lastAttemptCell.current === key) return;"));
 assert.ok(s.includes("if (lastAttemptCell.current !== key) lastAttemptCell.current = key;"));
});
test("QA215 only preserves a confirmed address near original GPS; old streets are never reused",()=>{
 for(const term of ["movedFromSuccess < 85","movedFromSuccess >= 120",
 "lastGeocodeRef.current = null;","addressKnownRef.current = false;",
 "setAddress(null); setPickupLabel(null); setPickupShortLabel(null);",
 'setStatus(addressKnownRef.current ? "success" : "error");'])
 assert.ok(s.includes(term),term);
});
test("QA215 still calls deployed, authenticated/quotable endpoint and keeps UI error recovery",()=>{
 for(const term of ['"google-maps-address"','action: "reverse_geocode"',
 "setPickupShortLabel(exactShortLabel)","setPickupLabel(exactAddress)",
 'setStatus("success");',
 'throw new Error("Não foi possível consultar o endereço. Verifique sua conexão.");'])
 assert.ok(s.includes(term),term);
});
