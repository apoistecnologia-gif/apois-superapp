import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const source = readFileSync(resolve('scripts/install-partner-qa235-native-auto-arrival.mjs'), 'utf8');
const servicePath = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro/DriverLocationService.java');

test('QA280 asks for fresh Android GPS only in an armed driver pickup', () => {
  for (const marker of [
    'qa280RequestFreshPickupFix()',
    'qa280PickupFixPending',
    'CurrentLocationRequest.Builder()',
    '.setPriority(Priority.PRIORITY_HIGH_ACCURACY)',
    '.setMaxUpdateAgeMillis(0L)',
    '.setDurationMillis(10_000L)',
    'ACCESS_FINE_LOCATION',
    '!qa235RideId.isEmpty()',
  ]) assert.ok(source.includes(marker), 'Missing native safeguard: ' + marker);
});

test('QA280 leaves official arrival validation and native presence mechanism intact', () => {
  for (const marker of [
    'qa235Fixes<3 || now-qa235FirstAt<6500L',
    'location.getAccuracy()>65f',
    'location.distanceTo(pickup)>85f',
    '/rest/v1/rpc/driver_mark_arrived',
    'qa235CheckPickupArrival(fresh)',
    'queuePresenceSync(true, fresh)',
    'qa235SendPush("ride.driver_arrived",rideId)',
    'START_REDELIVER_INTENT',
  ]) assert.ok(source.includes(marker), 'Arrival invariant changed: ' + marker);
  assert.ok(!source.includes('CourierLocationService'), 'Motorista repair must not alter courier service');
});

test('QA280 requires a new GPS fix and prevents overlapping fresh GPS requests', () => {
  assert.ok(source.includes('if (fresh == null || !isUsableLocation(fresh)) return;'));
  assert.ok(source.includes('|| qa280PickupFixPending || qa235Sending'));
  assert.ok(source.includes('qa280PickupFixPending = true'));
  assert.ok(source.includes('qa280PickupFixPending = false'));
  assert.ok(source.indexOf('queuePresenceSync(true, fresh)') < source.indexOf('qa235CheckPickupArrival(fresh)'));
});

test('QA280 generated Android service carries the fix (when native project exists)', (t) => {
  if (!existsSync(servicePath)) { t.skip('Native project not generated yet; test installer source above'); return; }
  const native = readFileSync(servicePath, 'utf8');
  for (const marker of ['qa280RequestFreshPickupFix()', 'getCurrentLocation(request, cancellation.getToken())', 'qa235CheckPickupArrival(fresh)', 'setMaxUpdateAgeMillis(0L)']) {
    assert.ok(native.includes(marker), 'Generated DriverLocationService missing: ' + marker);
  }
});
