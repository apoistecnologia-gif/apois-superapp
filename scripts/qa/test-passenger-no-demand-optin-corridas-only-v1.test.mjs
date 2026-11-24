// Corridas-only: remove optional demand sharing, NOT required ride GPS.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const workspace=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const home=readFileSync(resolve(workspace,'src/routes/_authenticated.inicio.tsx'),'utf8');
const gps=readFileSync(resolve(workspace,'src/hooks/use-location.tsx'),'utf8');
test('Public home omits optional region sharing and its network RPCs',()=>{
  for(const token of ['PassengerDemandSharing','APOIS_PASSENGER_QA218_OPTIN_V1',
    'Compartilhar minha região','apois_passenger_presence_ping','apois_passenger_presence_stop'])
    assert.ok(!home.includes(token),'[FAIL] Optional region share still mounted: '+token);
  assert.ok(!existsSync(resolve(workspace,'src/components/map/PassengerDemandSharing.tsx')),
    '[FAIL] Optional region sharing source compiled into rides-only');
});
test('Required passenger GPS provider and ride-origin UI remain intact',()=>{
  for(const token of ['useLocation()','location.latitude','location.longitude',
    'refreshLocation','locationError','<PassengerMap','initiateReview'])
    assert.ok(home.includes(token),'[FAIL] Ride GPS missing: '+token);
  for(const token of ['Geolocation.checkPermissions()', 'Geolocation.getCurrentPosition(',
    'Geolocation.watchPosition(', 'Geolocation.requestPermissions('])
    assert.ok(gps.includes(token),'[FAIL] GPS provider missing: '+token);
});
