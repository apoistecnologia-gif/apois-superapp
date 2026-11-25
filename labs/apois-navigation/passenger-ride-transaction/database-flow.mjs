import assert from 'node:assert/strict'
import { createPassengerSelectionFlow } from '../osm-search/passenger-flow.mjs'

export async function verifyPassengerDatabaseFlow(query) {
  const actor = '00000000-0000-4000-8000-000000000011'
  const passenger = '00000000-0000-4000-8000-000000000001'
  const pickup = '00000000-0000-4000-8000-000000000021'
  const destination = '00000000-0000-4000-8000-000000000022'
  const requestKey = '00000000-0000-4000-8000-000000000035'
  const digest = 'a'.repeat(64)
  const common = { version: 1, lng: -40.5, active: true, extract_sha256: digest }
  const flow = createPassengerSelectionFlow({
    source: 'OSM_PBF', version: 1, extract_sha256: digest,
    rows: [
      { ...common, id: pickup, lat: -9.4, label: 'Ponto A' },
      { ...common, id: destination, lat: -9.42, label: 'Ponto B' },
    ],
  }, {
    confirm: body => query(
      'select apois_nav_lab.confirm_selection($1,$2,$3,$4,$5,$6)',
      [actor, body.requestKey, body.pickup.id, body.pickup.version,
        body.destination.id, body.destination.version],
    ),
  })
  const confirmed = await flow.confirmRideInput({
    requestKey,
    pickupId: flow.suggestForMapTap({ lat: -9.4001, lng: -40.5 }).id,
    destinationId: flow.search('ponto b')[0].id,
    confirmed: true,
  })
  assert.equal(confirmed?.requestKey, requestKey)
  const payload = {
    passenger_id: passenger, request_key: requestKey, category: 'carros',
    status: 'procurar_motorista', intermediates: [],
    origin_lat: confirmed.origin.lat, origin_lng: confirmed.origin.lng,
    destination_lat: confirmed.destination.lat, destination_lng: confirmed.destination.lng,
    origin_name: confirmed.origin.label, destination_name: confirmed.destination.label,
    estimated_price: 12.34, payment_method: 'pix',
  }
  const create = () => query('select to_jsonb(r) from apois_nav_lab.create_passenger_ride($1,$2,$3,$4::jsonb) r',
    [actor, confirmed.selectionId, requestKey, JSON.stringify(payload)])
  const [created, retried] = await Promise.all([create(), create()])
  assert.ok(created?.id)
  assert.equal(retried?.id, created.id)
  assert.equal(created.estimated_price, 12.34)
  assert.equal(created.payment_method, 'pix')
  assert.equal(await query('select count(*) from public.rides where request_key=$1', [requestKey]), 1)
  assert.equal(await query('select to_jsonb(ride_id) from apois_nav_lab.selection where id=$1',
    [confirmed.selectionId]), created.id)
}
