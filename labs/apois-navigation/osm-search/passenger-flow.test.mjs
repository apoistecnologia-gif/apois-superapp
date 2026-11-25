import assert from 'node:assert/strict'
import test from 'node:test'
import { createPassengerSelectionFlow } from './passenger-flow.mjs'

const digest = 'b'.repeat(64)
const requestedAt = Date.parse('2026-11-25T15:00:00Z')
const [pickupId, destinationId, requestKey, selectionId] =
  [1, 2, 3, 4].map(i => '00000000-0000-4000-8000-00000000000' + i)
const shared = { version: 1, extract_sha256: digest, active: true, lng: -40.5 }
const catalog = {
  source: 'OSM_PBF', version: 1, extract_sha256: digest,
  rows: [
    { ...shared, id: pickupId, label: 'Praça da Sé', lat: -9.4 },
    { ...shared, id: destinationId, label: 'Rua São José, 12', lat: -9.41 },
  ],
}
const draft = { pickupId, destinationId, requestKey, confirmed: true }
const response = {
  selectionId, requestKey, expiresAt: new Date(requestedAt + 60000).toISOString(),
  origin: { lat: -9.4, lng: -40.5, label: 'Praça da Sé' },
  destination: { lat: -9.41, lng: -40.5, label: 'Rua São José, 12' },
}

test('search and map suggestions produce a confirmed ride input with the same request key', async () => {
  const flow = createPassengerSelectionFlow(catalog, {
    now: () => requestedAt,
    confirm: async body => {
      assert.deepEqual(body, {
        requestKey, confirmed: true,
        pickup: { id: pickupId, version: 1 }, destination: { id: destinationId, version: 1 },
      })
      return response
    },
  })
  assert.equal(flow.search('sao jose 12')[0].id, destinationId)
  assert.equal(flow.suggestForMapTap({ lat: -9.4002, lng: -40.5 }).id, pickupId)
  assert.deepEqual(await flow.confirmRideInput(draft), response)
})

test('unconfirmed, cancelled and expired selections produce no ride input', async () => {
  let calls = 0
  const flow = createPassengerSelectionFlow(catalog, {
    now: () => requestedAt + 120000,
    confirm: async () => { calls += 1; return response },
  })
  assert.equal(await flow.confirmRideInput({ ...draft, confirmed: false }), null)
  assert.equal(await flow.confirmRideInput(draft, AbortSignal.abort()), null)
  assert.equal(calls, 0)
  assert.equal(await flow.confirmRideInput(draft), null)
  assert.equal(calls, 1)
})
