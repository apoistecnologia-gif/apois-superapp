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
 'onClick={() => { refreshLocation(); void refreshAddress(); }}',
 'navigate({ to: "/buscar-destino", search: { stop: false } })'
])assert.ok(home.includes(s),'Pickup retry visual/behavior regression '+s);
for(const s of [
 'APOIS_PICKUP_REVERSE_DIAGNOSTIC_V1',
 'status === 429',
 'status === 401 || status === 403',
 'status >= 500',
 'addressKnownRef.current ? "success" : "error"',
 'runningCell.current = false;',
 'timeout = setTimeout',
 'action: "reverse_geocode"'
])assert.ok(hook.includes(s),'Pickup failure handling regression '+s);
assert.ok(!home.includes('Toque para tentar identificar o endereço'),'Misleading pickup CTA must be removed');
assert.ok(!hook.includes('setPickupLabel(null)'),'Do not remove previously known address label during a temporary outage');
// The real 1.0.11-qa.1001 APK locked runningCell BEFORE jitter check.
// If user movement was <85m, refreshAddress returned before try/finally and
// the entire pickup retry was permanently stuck. Lock must be last.
assert.ok(hook.includes('APOIS_PICKUP_NO_EARLY_RUNNING_LOCK_V2'),'GPS retry lock regression guard missing');
const jitter=hook.indexOf('if (Math.hypot(north, east) < 85) return;');
const busy=hook.indexOf('geocodeBusyRef.current = true;');
const lock=hook.indexOf('runningCell.current = true;');
const retryTry=hook.indexOf('    try {',lock);
const release=hook.indexOf('runningCell.current = false;',retryTry);
assert.ok(jitter>=0 && busy>jitter && lock>busy && retryTry>lock && release>retryTry,
  'Pickup lock must be acquired only after jitter exit and released in finally');
assert.ok(!/\breturn\b/.test(hook.slice(lock,retryTry)),
  'Never return after claiming lock but before finally cleanup');

assert.ok(!home.includes('address || "Sua localização atual"'),'Never report an unverified address');
const origin=home.indexOf('data-apois-pickup-retry-v1');
const branch=home.lastIndexOf('onClick={() => { refreshLocation(); void refreshAddress(); }}',origin);
assert.ok(branch>=0&&origin-branch<1500,'The origin row must refresh GPS + geocoding');
const destination=home.indexOf('>Destino</span>',origin);
assert.ok(destination>origin&&home.slice(origin,destination).includes('navigate({ to: "/buscar-destino"'),'Destination must keep its own navigation handler');
console.log('[PASS] Pickup failure: origin row retries reverse geocode; short actionable label; no stale address; HTTP 429/5xx distinguished');
