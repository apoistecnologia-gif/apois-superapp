import { existsSync,readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path=resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/partner-entregador","src/routes/courier.tsx");
if (!existsSync(path)) throw Error("[FAIL] courier source missing");
const before=readFileSync(path,"utf8");
let source=before;
const edits = [["  const loadCourierOperations = useCallback(async (courierId: string) => {","  // APOIS_COURIER_MANUAL_ONLINE_V1\n  const loadCourierOperations = useCallback(async (courierId: string, resetOnEntry = false) => {","operations signature"],["    setAvailability(availabilityRes.data ?? null);","    // Only a new app/login entry resets a previously saved online session.\n    // Active jobs always take priority, so courier can finish an ongoing delivery.\n    // Do not reset if availability or jobs could not be verified.\n    if (resetOnEntry && availabilityRes.error) throw availabilityRes.error;\n    if (resetOnEntry && jobsRes.error) throw jobsRes.error;\n    let effectiveAvailability = availabilityRes.data ?? null;\n    if (resetOnEntry && !jobsRes.data && effectiveAvailability?.is_online) {\n      const { data: updated, error: offlineError } = await rpc(\"set_courier_online\", {\n        _is_online: false,\n      });\n      if (offlineError) throw offlineError;\n      effectiveAvailability = updated ?? { ...effectiveAvailability, is_online: false, online_since: null };\n    }\n    setAvailability(effectiveAvailability);","reset persisted online on first entry"],["    setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);","    setOffers(effectiveAvailability?.is_online && Array.isArray(offersRes.data) ? offersRes.data : []);","display offers only when courier available"],["    async (quiet = false) => {","    async (quiet = false, resetOnEntry = false) => {","loadAll signature"],["          await loadCourierOperations(courierRow.id);","          await loadCourierOperations(courierRow.id, resetOnEntry);","load initial operations"],["  useEffect(() => {\n    void loadAll();\n  }, [loadAll]);","  const initialEntryCompletedRef = useRef(false);\n  useEffect(() => {\n    if (initialEntryCompletedRef.current) return;\n    initialEntryCompletedRef.current = true;\n    void loadAll(false, true);\n  }, [loadAll]);","initial entry only"],["import { useCallback, useEffect, useState } from \"react\";","import { useCallback, useEffect, useRef, useState } from \"react\";","ref imported"]];
for (const [oldText,newText,description] of edits) {
 if(source.includes(newText)) continue;
 if(!source.includes(oldText)) throw Error("[FAIL] courier source changed: "+description);
 source=source.replace(oldText,newText);
}
if(!source.includes("APOIS_COURIER_MANUAL_ONLINE_V1") ||
 !source.includes("resetOnEntry && !jobsRes.data") ||
 !source.includes("loadAll(false, true)")) throw Error("[FAIL] Manual-online verification failed");
if(source!==before)writeFileSync(path,source,"utf8");
console.log("[OK] Login offline by default; active jobs preserved; online only by driver choice");
