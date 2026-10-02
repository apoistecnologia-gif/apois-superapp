import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: contrato final não confirmado`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

patch(
  'src/services/places/places-service.ts',
  (source) => {
    let next = source;

    if (!next.includes('APOIS_LOCAL_PLACES_V1')) {
      next = next.replace(
        'class PlacesService {',
        `const normalizeLocality = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .trim();

// APOIS_LOCAL_PLACES_V1
class PlacesService {`,
      );
    }

    next = next.replace(
      `  public async searchPredictions(
    query: string,
    locationBias?: { lat: number; lng: number },
  ): Promise<PlaceSuggestion[]> {`,
      `  public async searchPredictions(
    query: string,
    locationBias?: { lat: number; lng: number },
    localityHint?: string,
  ): Promise<PlaceSuggestion[]> {`,
    );

    next = next.replace(
      '    const cacheKey = `${normalizedQuery.toLowerCase()}`;',
      `    const locationKey = locationBias
      ? locationBias.lat.toFixed(3) + "," + locationBias.lng.toFixed(3)
      : "no-location";
    const localityKey = normalizeLocality(localityHint ?? "");
    const cacheKey = normalizedQuery.toLowerCase() + "|" + locationKey + "|" + localityKey;`,
    );

    next = next.replace(
      '        input: normalizedQuery,',
      '        input: localityHint ? `${normalizedQuery}, ${localityHint}` : normalizedQuery,',
    );

    next = next.replace(
      `      if (locationBias) {
        // Bias circular de 10km (raio urbano centralizado)
        request.locationBias = {
          center: { lat: locationBias.lat, lng: locationBias.lng },
          radius: 10000,
        };
      }`,
      `      if (locationBias) {
        // Restrição real, não apenas bias: evita sugestões de cidades/estados
        // distantes. O filtro de localidade abaixo mantém somente o município
        // atual quando o reverse geocode fornece esse dado.
        const latDelta = 0.45;
        const cosine = Math.max(Math.cos((locationBias.lat * Math.PI) / 180), 0.2);
        const lngDelta = Math.min(0.75, latDelta / cosine);
        request.locationRestriction = {
          north: Math.min(90, locationBias.lat + latDelta),
          south: Math.max(-90, locationBias.lat - latDelta),
          east: Math.min(180, locationBias.lng + lngDelta),
          west: Math.max(-180, locationBias.lng - lngDelta),
        };
        request.origin = { lat: locationBias.lat, lng: locationBias.lng };
      }`,
    );

    next = next.replace(
      '      const suggestions = googleSuggestions.map((s: any) => this.normalizeSuggestion(s));',
      `      const suggestions = googleSuggestions.map((s: any) => this.normalizeSuggestion(s));
      const localSuggestions = localityKey
        ? suggestions.filter((suggestion: PlaceSuggestion) => {
            const searchable = normalizeLocality(
              (suggestion.secondaryText ?? "") + " " + (suggestion.fullText ?? ""),
            );
            return searchable.includes(localityKey);
          })
        : suggestions;`,
    );

    next = next.replace(
      '      this.cache.set(cacheKey, { data: suggestions, timestamp: Date.now() });\n\n      return suggestions;',
      '      this.cache.set(cacheKey, { data: localSuggestions, timestamp: Date.now() });\n\n      return localSuggestions;',
    );

    return next;
  },
  (source) =>
    source.includes('APOIS_LOCAL_PLACES_V1') &&
    source.includes('locationRestriction') &&
    source.includes('request.origin') &&
    source.includes('localityHint?: string') &&
    source.includes('localSuggestions') &&
    source.includes('locationKey'),
  'Corridas: Places restringe sugestões à região e município atual',
);

patch(
  'src/hooks/use-destination-search.tsx',
  (source) => {
    let next = source;

    if (!next.includes('APOIS_LOCALITY_HINT_V1')) {
      next = next.replace(
        'export function useDestinationSearch() {',
        `const extractLocalityHint = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  const cityState = parts.find((part) => /\\s-\\s[A-Z]{2}$/i.test(part));
  if (cityState) return cityState.replace(/\\s-\\s[A-Z]{2}$/i, "").trim();

  // pickupLabel normalmente é "Rua..., Cidade".
  return (parts[1] ?? parts[0] ?? "").replace(/\\s-\\s[A-Z]{2}$/i, "").trim();
};

// APOIS_LOCALITY_HINT_V1
export function useDestinationSearch(localityHint?: string | null) {`,
      );
    }

    next = next.replace(
      '  const { currentPosition } = useLocation();',
      '  const { currentPosition } = useLocation();\n  const locality = extractLocalityHint(localityHint);',
    );

    next = next.replace(
      `        const results = await placesService.searchPredictions(
          text,
          currentPosition
            ? { lat: currentPosition.latitude, lng: currentPosition.longitude }
            : undefined,
        );`,
      `        const results = await placesService.searchPredictions(
          text,
          currentPosition
            ? { lat: currentPosition.latitude, lng: currentPosition.longitude }
            : undefined,
          locality || undefined,
        );`,
    );

    if (!next.includes('    [currentPosition, locality],')) {
      next = next
        .replace('    [location],', '    [currentPosition, locality],')
        .replace('    [currentPosition],', '    [currentPosition, locality],');
    }

    return next;
  },
  (source) =>
    source.includes('APOIS_LOCALITY_HINT_V1') &&
    source.includes('useDestinationSearch(localityHint?: string | null)') &&
    source.includes('locality || undefined') &&
    source.includes('[currentPosition, locality]'),
  'Corridas: busca de destino usa município derivado do endereço atual',
);

patch(
  'src/routes/_authenticated.buscar-destino.tsx',
  (source) => {
    let next = source;
    next = next.replace(
      '  const { pickupLabel } = usePickupAddress();',
      '  const { pickupLabel, address: pickupAddress } = usePickupAddress();',
    );
    next = next.replace(
      '    useDestinationSearch();',
      '    useDestinationSearch(pickupAddress ?? pickupLabel);',
    );
    return next;
  },
  (source) =>
    source.includes('address: pickupAddress') &&
    source.includes('useDestinationSearch(pickupAddress ?? pickupLabel)'),
  'Corridas: rota de destino entrega a cidade atual ao autocomplete',
);

console.log('[OK] Corridas: autocomplete local evita sugestões de outros estados quando a cidade atual é conhecida.');
