// APOIS_DRIVER_CANONICAL_HEADER_NAME_GATE_V1 — static checks, no build/deploy.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const source=readFileSync(resolve(root,"src/components/MovviHeader.tsx"),"utf8");
for(const marker of [
  "APOIS_DRIVER_CANONICAL_HEADER_NAME_V1",
  'state.location.pathname.startsWith("/motorista/")',
  'rpc("driver_get_profile")',
  "if (!isDriverRoute)",
  "queueMicrotask",
  "request === nameSequenceRef.current",
  "subscription.subscription.unsubscribe();",
]) assert.ok(source.includes(marker),"header contract missing: "+marker);
assert.ok(!source.includes('setName(displayNameFromUser(session?.user))'),
  "driver header must prioritize canonical profile name over Google alias");
assert.ok(source.includes('return (fullName || name || emailName || "Motorista")'),
  "non-Motorista auth fallback must remain unchanged");
console.log("[OK] Motorista: canonical driver header name scoped to driver routes; no app generated.");
