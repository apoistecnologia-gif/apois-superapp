import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const patch = readFileSync(resolve('scripts/fix-partner-qa280-driver-active-gps-recovery.mjs'),'utf8');
const routePath=resolve('.work/partner-motorista/src/routes/motorista.app.tsx');

test('QA280 recovery cannot be shown without an active ride', () => {
  assert.ok(patch.includes('active && (!online || gpsStatus === "error")'));
  assert.ok(patch.includes('["motorista_a_caminho","motorista_chegou","em_viagem"].includes(active.status)'));
  assert.ok(patch.includes('data-apois-qa280-recover-gps'));
});

test('QA280 requires server-assigned ride, auth and real accurate GPS before ONLINE', () => {
  for(const marker of [
    'await supabase.auth.getSession()',
    '.select("status,driver_id").eq("id",ride.id).maybeSingle()',
    'live.driver_id !== driverId',
    'Geolocation.getCurrentPosition({enableHighAccuracy:true,maximumAge:0,timeout:20000})',
    '!Number.isFinite(accuracy) || accuracy > 65',
    'startNativeDriverLocation()',
    'driver_set_presence',
    'result.data?.is_online !== true',
    'setDesiredOnline(true)',
    'stopNativeDriverLocation()',
  ]) assert.ok(patch.includes(marker), 'Missing QA280 recovery guard: '+marker);
  assert.ok(patch.indexOf('result.data?.is_online !== true') < patch.indexOf('setDesiredOnline(true)'), 'Local ONLINE before backend ACK');
});

test('QA280 recovery has no money, PIN, finish or fake-arrival operation', () => {
  for(const forbidden of ['iniciarCorridaMobile(', 'finalizarCorridaMobile(', 'callStart(', 'callComplete(', 'driver_mark_arrived(', 'ride_settlements', 'driver_wallet_transactions', 'simulatedGps']) {
    assert.ok(!patch.includes(forbidden),'Forbidden effect in recovery patch: '+forbidden);
  }
  assert.ok(!patch.includes('courier.tsx') && !patch.includes('CourierLocationService'));
});

test('QA280 generated route has recovery button when disposable workspace exists', t => {
  if (!existsSync(routePath)) { t.skip('Motorista workspace not generated yet'); return; }
  const route=readFileSync(routePath,'utf8');
  assert.ok(route.includes('APOIS_PARTNER_QA280_ACTIVE_GPS_RECOVERY_V1'));
  assert.ok(route.includes('data-apois-qa280-recover-gps'));
  assert.ok(route.includes('data-apois-qa236-start-ride'));
});
