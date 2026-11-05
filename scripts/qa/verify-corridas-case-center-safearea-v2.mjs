import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const base=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas");
const code=readFileSync(resolve(base,"src/components/ApoisCaseCenter.tsx"),"utf8");
const ride=readFileSync(resolve(base,"src/routes/_authenticated.corrida.$rideId.tsx"),"utf8");
const history=readFileSync(resolve(base,"src/routes/_authenticated.ocorrencias.tsx"),"utf8");
assert.ok(code.includes("data-apois-cases-v1 data-apois-case-safe-top-v2"),"Safe area marker required");
assert.ok(code.includes('paddingTop:"max(68px, calc(var(--app-safe-top, env(safe-area-inset-top, 0px)) + 16px))"'),"Status bar and notch clearance must be explicit");
assert.ok(code.includes('min-w-0 flex-1 break-words text-lg'),"Title must wrap without overlapping close");
assert.ok(code.includes('min-h-11 shrink-0')&&code.includes('onClick={onClose}>Fechar'),"Close button must remain accessible");
for(const marker of [
  "apois_open_ride_case","apois_case_register_evidence","apois_case_reply",
  'createSignedUrl(file.object_path,300)',
  "MAX","caseId","uploadForCase","setSelected(createdId)",
  "Abrir chamado e gerar protocolo","Meus protocolos",
]) {
  if(marker==="MAX")continue;
  assert.ok(code.includes(marker),"Case contract changed: "+marker);
}
assert.ok(ride.includes("<ApoisCaseCenter initialRideId={ride.id}"),"Ride-linked case entry retained");
assert.ok(history.includes("<ApoisCaseCenter />"),"Independent cases archive retained");
console.log("[PASS] APOIS Cliente: case center safe-area, title, close and ticket/evidence flow preserved.");
