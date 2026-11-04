// Regression against misleading "tap to identify" error on Corridas origin.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const dir=resolve('.work/corridas/src');
const home=readFileSync(resolve(dir,'routes/_authenticated.inicio.tsx'),'utf8');
const hook=readFileSync(resolve(dir,'hooks/use-pickup-address.tsx'),'utf8');
for(const s of [
 'Endereço indisponível',
 'data-apois-pickup-retry-v1',
 'Toque para tentar novamente',
 'if (addressStatus === "error") { void refreshAddress(); return; }',
 'navigate({ to: "/buscar-destino", search: { stop: false } });'
])assert.ok(home.includes(s),'Pickup retry visual/behavior regression '+s);
for(const s of [
 'APOIS_PICKUP_REVERSE_DIAGNOSTIC_V1',
 'status === 429',
 'status === 401 || status === 403',
 'status >= 500',
 'setPickupLabel(null)',
 'setPickupShortLabel(null)',
 'runningCell.current = false;',
 'timeout = setTimeout',
 'action: "reverse_geocode"'
])assert.ok(hook.includes(s),'Pickup failure handling regression '+s);
assert.ok(!home.includes('Toque para tentar identificar o endereço'),'Misleading pickup CTA must be removed');
assert.ok(!home.includes('address || "Sua localização atual"'),'Never report an unverified address');
const origin=home.indexOf('data-apois-pickup-retry-v1');
const branch=home.lastIndexOf('if (addressStatus === "error")',origin);
assert.ok(branch>=0&&origin-branch<1500,'The origin row must retry the address without navigating to destination');
console.log('[PASS] Pickup failure: origin row retries reverse geocode; short actionable label; no stale address; HTTP 429/5xx distinguished');
