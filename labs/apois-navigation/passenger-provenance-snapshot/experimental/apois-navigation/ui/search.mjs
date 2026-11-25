// Offline search over public OSM catalog rows. Activation remains explicit.
const MAX_RESULTS = 20
const MAX_QUERY_LENGTH = 120

function normalize(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

export function createOsmSearch(catalog) {
  if (catalog?.source !== 'OSM_PBF' || !Array.isArray(catalog.rows)) {
    throw new TypeError('Expected an offline OSM catalog')
  }

  const index = catalog.rows.filter(row =>
    row?.active === true && typeof row.id === 'string' && row.version === catalog.version &&
    row.extract_sha256 === catalog.extract_sha256 && typeof row.label === 'string' &&
    Number.isFinite(row.lat) && Number.isFinite(row.lng),
  ).map(row => {
    const label = normalize(row.label)
    const fields = [row.label, row.street, row.house_number, row.neighborhood]
    const text = normalize(fields.filter(field => typeof field === 'string').join(' '))
    return {
      point: { id: row.id, version: row.version, label: row.label, lat: row.lat, lng: row.lng },
      label,
      words: text.split(' '),
    }
  })

  return (query, limit = MAX_RESULTS) => {
    if (typeof query !== 'string' || query.length > MAX_QUERY_LENGTH) return []
    if (!Number.isInteger(limit) || limit < 1) return []
    const normalized = normalize(query)
    if (normalized.length < 2) return []

    const terms = [...new Set(normalized.split(' '))]
    const matches = []
    for (const entry of index) {
      let prefixCount = 0
      let matched = true
      for (const term of terms) {
        if (entry.words.includes(term)) continue
        if (/^\p{N}/u.test(term) || !entry.words.some(word => word.startsWith(term))) {
          matched = false
          break
        }
        prefixCount += 1
      }
      if (matched) matches.push({
        point: entry.point,
        rank: entry.label === normalized ? 0 : 1 + prefixCount,
      })
    }

    return matches
      .sort((a, b) => a.rank - b.rank ||
        a.point.label.localeCompare(b.point.label, 'pt-BR') ||
        a.point.id.localeCompare(b.point.id))
      .slice(0, Math.min(limit, MAX_RESULTS))
      .map(({ point }) => ({ ...point }))
  }
}
