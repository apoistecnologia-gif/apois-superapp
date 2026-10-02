import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error('[FAIL] ' + label + ': contrato final não confirmado');
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log('[OK] ' + label + (after === before ? ' (já aplicado)' : ''));
}

patch(
  'src/services/places/places-service.ts',
  (source) => {
    let next = source;

    if (!next.includes('APOIS_NATIVE_PLACES_FASTPATH_V1')) {
      next = next.replace(
        '  public async searchPredictions(\n',
        `  // APOIS_NATIVE_PLACES_FASTPATH_V1
  private async searchNativeFallback(
    normalizedQuery: string,
    locationBias: { lat: number; lng: number } | undefined,
    localityHint: string | undefined,
    localityKey: string,
    cacheKey: string,
    requestId: number,
  ): Promise<PlaceSuggestion[]> {
    const { data, error } = await supabase.functions.invoke("google-maps-address", {
      body: {
        action: "autocomplete",
        input: normalizedQuery,
        localityHint: localityHint || undefined,
        ...(locationBias ? { lat: locationBias.lat, lng: locationBias.lng } : {}),
      },
    });
    if (error) throw error;
    if (requestId !== this.lastRequestId) throw this.normalizeError("places_cancelled");

    const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
    const suggestions: PlaceSuggestion[] = predictions
      .map((prediction: any) => ({
        placeId: String(prediction?.place_id ?? ""),
        primaryText: String(prediction?.structured_formatting?.main_text ?? prediction?.description ?? ""),
        secondaryText: String(prediction?.structured_formatting?.secondary_text ?? ""),
        fullText: String(prediction?.description ?? ""),
        types: Array.isArray(prediction?.types) ? prediction.types : [],
      }))
      .filter((prediction: PlaceSuggestion) => Boolean(prediction.placeId && prediction.primaryText));

    const localSuggestions = localityKey
      ? suggestions.filter((suggestion: PlaceSuggestion) => {
          const searchable = normalizeLocality(
            (suggestion.secondaryText ?? "") + " " + (suggestion.fullText ?? ""),
          );
          return searchable.includes(localityKey);
        })
      : suggestions;

    if (this.cache.size >= PLACES_CONFIG.CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, { data: localSuggestions, timestamp: Date.now() });
    return localSuggestions;
  }

  public async searchPredictions(
`
      );
    }

    const nativeBlock = /\n\s{4}if \(Capacitor\.isNativePlatform\(\)\) \{\n\s{6}try \{\n\s{8}const \{ data, error \} = await supabase\.functions\.invoke\("google-maps-address", \{\n\s{10}body: \{ action: "autocomplete",[\s\S]*?\n\s{4}\}\n\n\s{4}await this\.initialize\(\);/;
    next = next.replace(
      nativeBlock,
      `
    if (Capacitor.isNativePlatform()) {
      const directReady = this.placesLib
        ? true
        : await Promise.race([
            this.initialize().then(() => true).catch(() => false),
            new Promise<boolean>((resolveReady) => window.setTimeout(() => resolveReady(false), 250)),
          ]);
      if (!directReady) {
        try {
          return await this.searchNativeFallback(
            normalizedQuery,
            locationBias,
            localityHint,
            localityKey,
            cacheKey,
            requestId,
          );
        } catch (error: any) {
          if (error?.code === "places_cancelled") throw error;
          console.error("Native Places fallback error:", error);
          throw this.normalizeError("places_network_error");
        }
      }
    } else {
      await this.initialize();
    }
`
    );

    next = next.replace(
      `      console.error("Places Search Error:", error);

      // Tratar estados de erro específicos da biblioteca se necessário
      throw this.normalizeError("places_network_error");`,
      `      if (Capacitor.isNativePlatform()) {
        try {
          return await this.searchNativeFallback(
            normalizedQuery,
            locationBias,
            localityHint,
            localityKey,
            cacheKey,
            requestId,
          );
        } catch (fallbackError: any) {
          if (fallbackError?.code === "places_cancelled") throw fallbackError;
          console.error("Native Places fallback error:", fallbackError);
        }
      }

      console.error("Places Search Error:", error);
      throw this.normalizeError("places_network_error");`,
    );

    next = next.replace(
      '    if (Capacitor.isNativePlatform()) {\n      try {\n        const { data, error } = await supabase.functions.invoke("google-maps-address", {\n          body: { action: "place_details", placeId: prediction.placeId },',
      '    if (Capacitor.isNativePlatform() && !prediction?.place) {\n      try {\n        const { data, error } = await supabase.functions.invoke("google-maps-address", {\n          body: { action: "place_details", placeId: prediction.placeId },',
    );

    return next;
  },
  (source) =>
    source.includes('APOIS_NATIVE_PLACES_FASTPATH_V1') &&
    source.includes('Promise.race([') &&
    source.includes('window.setTimeout(() => resolveReady(false), 250)') &&
    source.includes('searchNativeFallback(') &&
    source.includes('Capacitor.isNativePlatform() && !prediction?.place') &&
    !source.includes('body: { action: "autocomplete", input: normalizedQuery, ...(locationBias'),
  'Corridas: Places nativo usa fast-path direto e fallback server-side curto',
);

patch(
  'src/routes/_authenticated.tsx',
  (source) => {
    let next = source;

    if (!next.includes('import { placesService } from "@/services/places/places-service";')) {
      next = next.replace(
        'import { usePushNotifications } from "@/hooks/use-push-notifications";',
        'import { usePushNotifications } from "@/hooks/use-push-notifications";\nimport { placesService } from "@/services/places/places-service";',
      );
    }

    if (!next.includes('function PlacesBootstrap()')) {
      next = next.replace(
        'function PushBootstrap() {',
        `function PlacesBootstrap() {
  useEffect(() => {
    void placesService.initialize().catch(() => undefined);
  }, []);
  return null;
}

function PushBootstrap() {`,
      );
    }

    if (!next.includes('<PlacesBootstrap />')) {
      next = next.replace(
        '<ActiveRideRecovery />\n                                  <PushBootstrap />',
        '<ActiveRideRecovery />\n                                  <PlacesBootstrap />\n                                  <PushBootstrap />',
      );
    }

    return next;
  },
  (source) =>
    source.includes('placesService.initialize().catch(() => undefined)') &&
    source.includes('function PlacesBootstrap()') &&
    source.includes('<PlacesBootstrap />'),
  'Corridas: Places começa a carregar antes de abrir a busca',
);

console.log('[OK] APOIS_NATIVE_PLACES_FASTPATH_V1: autocomplete nativo otimizado sem remover restrição local.');
