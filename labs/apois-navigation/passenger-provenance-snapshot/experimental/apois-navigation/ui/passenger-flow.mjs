import { confirmIndependentSelection } from '../../../src/services/navigation/independent-selection.ts'
import { createOsmSearch } from './search.mjs'
import { createSelectionCatalog } from './map-selection.mjs'

export function createPassengerSelectionFlow(catalog, { confirm, now = Date.now }) {
  const search = createOsmSearch(catalog)
  const selection = createSelectionCatalog(catalog)

  return {
    search,
    suggestForMapTap: selection.suggestForMapTap,
    async confirmRideInput(draft, signal) {
      const payload = selection.prepareConfirmation(draft)
      if (!payload) return null

      const confirmed = await confirmIndependentSelection(payload, confirm, signal, now)
      if (!confirmed) return null

      return Object.freeze({
        selectionId: confirmed.selectionId,
        requestKey: confirmed.requestKey,
        expiresAt: confirmed.expiresAt,
        origin: confirmed.origin,
        destination: confirmed.destination,
      })
    },
  }
}
