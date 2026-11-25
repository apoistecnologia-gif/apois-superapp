import { createPassengerSelectionFlow } from './passenger-flow.mjs'

// Laboratory UI state. Never creates a ride or silently forwards to the legacy flow.
export function createPassengerPanel({ enabled = false, catalog, confirm, now = Date.now, newKey = () => crypto.randomUUID() } = {}) {
  const flow = enabled === true ? createPassengerSelectionFlow(catalog, { confirm, now }) : null
  let phase = 'closed', field = 'pickup', pickup = null, destination = null, suggestion = null, result = null, pending = null, key = null
  const invalidate = () => { pending?.abort(); pending = null; result = null; key = null }
  const expire = () => {
    if (result && (!Number.isFinite(now()) || Date.parse(result.expiresAt) <= now())) {
      invalidate(); phase = 'expired'
    }
  }
  const state = () => { expire(); return { phase, field, pickup, destination, suggestion, result } }
  const open = () => { if (!flow || phase !== 'closed') return false; phase = 'editing'; return true }
  const close = () => { invalidate(); phase = 'closed'; pickup = destination = suggestion = null; field = 'pickup' }
  const edit = () => { if (!flow || phase === 'closed') return false; invalidate(); suggestion = null; phase = 'editing'; return true }
  const choose = point => {
    if (!point || !edit()) return false
    const frozen = Object.freeze({ ...point })
    if (field === 'pickup') pickup = frozen; else destination = frozen
    return true
  }
  const search = query => phase === 'closed' ? [] : flow.search(query)
  return {
    state, open, close, search,
    focus(next) { if (!['pickup','destination'].includes(next) || !edit()) return false; field = next; return true },
    selectSearch(query, id) { return choose(search(query).find(p => p.id === id)) },
    suggestTap(point) { if (!edit()) return null; suggestion = flow.suggestForMapTap(point); return suggestion },
    acceptSuggestion() { return choose(suggestion) },
    async confirm() {
      expire()
      if (!flow || !['editing','error','expired'].includes(phase) || !pickup || !destination ||
          pickup.id === destination.id || (pickup.lat === destination.lat && pickup.lng === destination.lng)) return null
      key ??= newKey()
      const attempt = new AbortController()
      pending = attempt; phase = 'confirming'; suggestion = null
      let value
      try { value = await flow.confirmRideInput({ requestKey: key, pickupId: pickup.id, destinationId: destination.id, confirmed: true }, attempt.signal) }
      catch { value = null }
      if (pending !== attempt || attempt.signal.aborted) return null
      pending = null
      const same = (a,b) => a && b && a.lat === b.lat && a.lng === b.lng && a.label === b.label
      if (!value || !same(value.origin,pickup) || !same(value.destination,destination)) { phase = 'error'; return null }
      result = value; phase = 'confirmed'; expire()
      return result
    },
    // A caller must explicitly request the still-valid input. No dispatch here.
    confirmedInput() { expire(); return phase === 'confirmed' ? result : null },
  }
}
