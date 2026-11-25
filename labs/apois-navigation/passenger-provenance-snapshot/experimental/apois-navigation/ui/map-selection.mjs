// Selection builds only the payload accepted by the independent confirmation client.
const MAX_SNAP_METERS = 60
const EARTH_RADIUS_METERS = 6371008.8
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function inRegion({ lat, lng } = {}) {
  return Number.isFinite(lat) && lat >= -9.65 && lat <= -9.10 &&
    Number.isFinite(lng) && lng >= -40.80 && lng <= -40.20
}

function distanceMeters(a, b) {
  const radians = Math.PI / 180
  const latDiff = (b.lat - a.lat) * radians
  const lngDiff = (b.lng - a.lng) * radians
  const h = Math.sin(latDiff / 2) ** 2 +
    Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(lngDiff / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function createSelectionCatalog(catalog) {
  if (catalog?.source !== 'OSM_PBF' || !Number.isInteger(catalog.version) ||
      catalog.version < 1 || catalog.version > 2147483647 ||
      !/^[0-9a-f]{64}$/.test(catalog.extract_sha256) || !Array.isArray(catalog.rows)) {
    throw new TypeError('Expected a versioned OSM catalog')
  }
  const points = new Map()
  for (const row of catalog.rows) {
    if (!row || row.active !== true || row.version !== catalog.version ||
        row.extract_sha256 !== catalog.extract_sha256 || !UUID.test(row.id) ||
        typeof row.label !== 'string' || !row.label.trim() || row.label.length > 120 ||
        !inRegion(row)) continue
    if (points.has(row.id)) throw new TypeError('Duplicate active catalog point')
    points.set(row.id, Object.freeze({ id: row.id, version: row.version, label: row.label, lat: row.lat, lng: row.lng }))
  }

  return {
    // A tap suggests a point. The caller still presents it for confirmation.
    suggestForMapTap(tap) {
      if (!tap || !inRegion(tap)) return null
      let closest = null
      let bestDistance = MAX_SNAP_METERS
      for (const point of points.values()) {
        const distance = distanceMeters(tap, point)
        if (distance < bestDistance || (distance === bestDistance && closest && point.id < closest.id)) {
          closest = point
          bestDistance = distance
        }
      }
      return closest
    },
    prepareConfirmation({ requestKey, pickupId, destinationId, confirmed } = {}) {
      if (confirmed !== true || typeof requestKey !== 'string' || !UUID.test(requestKey)) return null
      const pickup = points.get(pickupId)
      const destination = points.get(destinationId)
      if (!pickup || !destination || pickup === destination ||
          (pickup.lat === destination.lat && pickup.lng === destination.lng)) return null
      return {
        requestKey,
        pickup: { id: pickup.id, version: pickup.version },
        destination: { id: destination.id, version: destination.version },
        confirmed: true,
      }
    },
  }
}
