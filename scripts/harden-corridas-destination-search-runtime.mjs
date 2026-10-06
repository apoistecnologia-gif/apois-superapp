import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = resolve(root, '.work/corridas');
const file = (path) => resolve(workspace, path);

function write(path, content) {
  writeFileSync(file(path), content, 'utf8');
}

function requireMarkers(path, markers, label) {
  const source = readFileSync(file(path), 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) throw new Error(`[FAIL] ${label}: ${missing.join(' | ')}`);
  console.log(`[OK] ${label}`);
}

// APOIS_CORRIDAS_DESTINATION_SEARCH_EDGE_V1
// No APK, o autocomplete não deve depender do Maps JS dentro do WebView.
// O mapa nativo continua intacto; busca/detalhes passam pela Edge Function
// autenticada já usada pelo ecossistema e com fallback server-side.
write('src/services/places/places-service.ts', `import {
  PlaceSuggestion,
  PlacesError,
  DestinationAddress,
  AddressComponent,
  PlacesErrorCode,
  PLACES_MESSAGES_PT,
} from "../../types/places";
import { PLACES_CONFIG } from "./places-config";
import { supabase } from "../../integrations/supabase/client";

class PlacesService {
  private static instance: PlacesService;
  private cache: Map<string, { data: PlaceSuggestion[]; timestamp: number }> = new Map();
  private lastRequestId = 0;

  private constructor() {}

  public static getInstance(): PlacesService {
    if (!PlacesService.instance) PlacesService.instance = new PlacesService();
    return PlacesService.instance;
  }

  public async initialize(): Promise<void> {
    // Compatibilidade com a API anterior. Autocomplete/detalhes agora são server-side.
  }

  public createSessionToken(): void {}
  public resetSessionToken(): void {}

  private async invokeMaps(body: Record<string, unknown>): Promise<any> {
    let timeoutId: number | null = null;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(this.normalizeError("places_timeout")),
          Math.max(PLACES_CONFIG.TIMEOUT_MS, 12000),
        );
      });
      const requestPromise = supabase.functions
        .invoke("google-maps-address", { body })
        .then(({ data, error }) => {
          if (error) throw error;
          if (data?.error) throw new Error(String(data.error));
          return data;
        });
      return await Promise.race([requestPromise, timeoutPromise]);
    } finally {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    }
  }

  public async searchPredictions(
    query: string,
    locationBias?: { lat: number; lng: number },
  ): Promise<PlaceSuggestion[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < PLACES_CONFIG.MIN_CHARS) return [];

    const biasKey = locationBias
      ? `${locationBias.lat.toFixed(3)},${locationBias.lng.toFixed(3)}`
      : "no-bias";
    const cacheKey = `${normalizedQuery.toLowerCase()}|${biasKey}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PLACES_CONFIG.CACHE_TTL_MS) {
      return cached.data;
    }

    const requestId = ++this.lastRequestId;
    try {
      const data = await this.invokeMaps({
        action: "autocomplete",
        input: normalizedQuery,
        ...(locationBias ? { lat: locationBias.lat, lng: locationBias.lng } : {}),
      });

      if (requestId !== this.lastRequestId) throw this.normalizeError("places_cancelled");

      const predictions = Array.isArray(data?.predictions) ? data.predictions : [];
      const suggestions = predictions
        .map((prediction: any): PlaceSuggestion | null => {
          const placeId = String(prediction?.place_id ?? "").trim();
          const fullText = String(prediction?.description ?? "").trim();
          const primaryText = String(
            prediction?.structured_formatting?.main_text ?? fullText.split(",")[0] ?? "",
          ).trim();
          const secondaryText = String(
            prediction?.structured_formatting?.secondary_text ?? "",
          ).trim();
          if (!placeId || !primaryText) return null;
          return {
            placeId,
            primaryText,
            ...(secondaryText ? { secondaryText } : {}),
            fullText: fullText || [primaryText, secondaryText].filter(Boolean).join(", "),
            types: Array.isArray(prediction?.types) ? prediction.types : [],
          };
        })
        .filter((value: PlaceSuggestion | null): value is PlaceSuggestion => Boolean(value));

      if (this.cache.size >= PLACES_CONFIG.CACHE_MAX_SIZE) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, { data: suggestions, timestamp: Date.now() });
      return suggestions;
    } catch (error: unknown) {
      if ((error as PlacesError)?.code === "places_cancelled") throw error;
      throw this.normalizeProviderError(error);
    }
  }

  public async selectPrediction(prediction: PlaceSuggestion): Promise<DestinationAddress> {
    const placeId = prediction.placeId?.trim();
    if (!placeId) throw this.normalizeError("places_invalid_place_id");

    try {
      const data = await this.invokeMaps({ action: "place_details", placeId });
      const result = data?.result;
      const rawLocation = result?.geometry?.location;
      const latitude = Number(rawLocation?.lat);
      const longitude = Number(rawLocation?.lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw this.normalizeError("places_invalid_location");
      }

      const components: AddressComponent = {};
      const addressComponents = Array.isArray(result?.address_components)
        ? result.address_components
        : [];
      addressComponents.forEach((component: any) => {
        const types = Array.isArray(component?.types) ? component.types : [];
        const longText = String(component?.long_name ?? component?.longText ?? "").trim();
        const shortText = String(component?.short_name ?? component?.shortText ?? longText).trim();
        if (!longText) return;
        if (types.includes("route")) components.rua = longText;
        if (types.includes("street_number")) components.numero = longText;
        if (types.includes("neighborhood") || types.includes("sublocality") || types.includes("sublocality_level_1")) components.bairro = longText;
        if (types.includes("locality")) components.cidade = longText;
        if (types.includes("administrative_area_level_1")) {
          components.estado = longText;
          components.estadoSigla = shortText;
        }
        if (types.includes("postal_code")) components.cep = longText;
        if (types.includes("country")) components.pais = longText;
      });

      const formattedAddress =
        prediction.fullText ||
        [
          [components.rua, components.numero].filter(Boolean).join(", "),
          components.bairro,
          components.cidade,
          components.estadoSigla,
        ].filter(Boolean).join(" - ") ||
        prediction.primaryText;

      return {
        placeId,
        latitude,
        longitude,
        label: prediction.primaryText || components.rua || components.cidade || "Local selecionado",
        ...(prediction.secondaryText ? { subLabel: prediction.secondaryText } : {}),
        formattedAddress,
        name: prediction.primaryText || formattedAddress,
        components,
        types: prediction.types || [],
        selectedAt: new Date().toISOString(),
        source: "google_places",
      };
    } catch (error: unknown) {
      if ((error as PlacesError)?.code?.startsWith("places_")) throw error;
      throw this.normalizeProviderError(error, "places_details_unavailable");
    }
  }

  public cancelPendingSearch(): void {
    this.lastRequestId += 1;
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public dispose(): void {
    this.clearCache();
    this.lastRequestId += 1;
  }

  private normalizeProviderError(
    error: unknown,
    fallback: PlacesErrorCode = "places_network_error",
  ): PlacesError {
    if ((error as PlacesError)?.code?.startsWith("places_")) return error as PlacesError;
    const message = String(
      (error as { message?: unknown })?.message ?? error ?? "",
    ).toLowerCase();
    if (message.includes("timeout") || message.includes("demorando")) {
      return this.normalizeError("places_timeout");
    }
    if (message.includes("muitas consultas") || message.includes("429") || message.includes("rate")) {
      return this.normalizeError("places_rate_limited");
    }
    if (message.includes("jwt") || message.includes("autentica") || message.includes("401")) {
      return this.normalizeError("places_configuration_missing");
    }
    return this.normalizeError(fallback);
  }

  private normalizeError(code: PlacesErrorCode): PlacesError {
    return { code, message: PLACES_MESSAGES_PT[code] };
  }
}

export const placesService = PlacesService.getInstance();
`);

write('src/hooks/use-destination-search.tsx', `import { useCallback, useEffect, useRef, useState } from "react";
import type { PlaceSuggestion, PlacesError, PlacesSearchStatus } from "../types/places";
import { placesService } from "../services/places/places-service";
import { PLACES_CONFIG } from "../services/places/places-config";
import { useLocation } from "./use-location";

const isPlacesError = (value: unknown): value is PlacesError => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record["code"] === "string" && typeof record["message"] === "string";
};

export function useDestinationSearch() {
  const { currentPosition } = useLocation();
  const [query, setQueryState] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [status, setStatus] = useState<PlacesSearchStatus>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<PlacesError | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<PlaceSuggestion | null>(null);
  const debounceTimer = useRef<number | null>(null);
  const requestSequence = useRef(0);

  const cancelDebounce = useCallback(() => {
    if (debounceTimer.current !== null) {
      window.clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
  }, []);

  const clearQuery = useCallback(() => {
    requestSequence.current += 1;
    cancelDebounce();
    placesService.cancelPendingSearch();
    setQueryState("");
    setSuggestions([]);
    setStatus("idle");
    setIsLoading(false);
    setError(null);
    setSelectedSuggestion(null);
  }, [cancelDebounce]);

  const search = useCallback(async (text: string) => {
    const normalizedText = text.trim();
    if (normalizedText.length < PLACES_CONFIG.MIN_CHARS) {
      setSuggestions([]);
      setStatus("below_minimum");
      setIsLoading(false);
      setError(null);
      return;
    }

    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setStatus("loading");
    setError(null);

    try {
      const results = await placesService.searchPredictions(
        normalizedText,
        currentPosition
          ? { lat: currentPosition.latitude, lng: currentPosition.longitude }
          : undefined,
      );
      if (requestId !== requestSequence.current) return;
      setSuggestions(results);
      setStatus(results.length ? "success" : "empty");
    } catch (caughtError: unknown) {
      if (requestId !== requestSequence.current) return;
      const placesError: PlacesError = isPlacesError(caughtError)
        ? caughtError
        : { code: "places_unknown_error", message: "Ocorreu um erro inesperado na busca." };
      if (placesError.code === "places_cancelled") return;
      setSuggestions([]);
      setError(placesError);
      setStatus(
        placesError.code === "places_rate_limited"
          ? "rate_limited"
          : placesError.code === "places_configuration_missing"
            ? "configuration_missing"
            : placesError.code === "places_network_error" || placesError.code === "places_timeout"
              ? "network_error"
              : "failed",
      );
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }, [currentPosition]);

  const setQuery = useCallback((text: string) => {
    const cleanText = text.replace(/^\\s+/, "");
    setQueryState(cleanText);
    setSelectedSuggestion(null);
    cancelDebounce();

    requestSequence.current += 1;
    placesService.cancelPendingSearch();
    setSuggestions([]);
    setIsLoading(false);
    setError(null);

    if (!cleanText) {
      setStatus("idle");
      return;
    }
    if (cleanText.trim().length < PLACES_CONFIG.MIN_CHARS) {
      setStatus("below_minimum");
      return;
    }

    setStatus("debouncing");
    debounceTimer.current = window.setTimeout(() => {
      debounceTimer.current = null;
      void search(cleanText);
    }, PLACES_CONFIG.DEBOUNCE_MS);
  }, [cancelDebounce, search]);

  const retry = useCallback(() => {
    cancelDebounce();
    if (query.trim().length >= PLACES_CONFIG.MIN_CHARS) void search(query);
  }, [cancelDebounce, query, search]);

  const reset = useCallback(() => {
    clearQuery();
    placesService.resetSessionToken();
  }, [clearQuery]);

  useEffect(() => () => {
    requestSequence.current += 1;
    cancelDebounce();
    placesService.cancelPendingSearch();
  }, [cancelDebounce]);

  return {
    query,
    suggestions,
    status,
    isLoading,
    selectedSuggestion,
    error,
    setQuery,
    clearQuery,
    retry,
    reset,
    setSelectedSuggestion,
  };
}
`);

const searchPath = 'src/routes/_authenticated.buscar-destino.tsx';
let searchSource = readFileSync(file(searchPath), 'utf8');
searchSource = searchSource
  .replace(
    '        <div className="flex flex-col h-full">',
    '        <div data-apois-stable-destination-sheet className="flex h-[78dvh] max-h-[760px] min-h-0 flex-col">',
  )
  .replaceAll('query.length < 2', 'query.trim().length < 3');
write(searchPath, searchSource);

requireMarkers(
  'src/services/places/places-service.ts',
  [
    'supabase.functions',
    'invoke("google-maps-address"',
    'action: "autocomplete"',
    'action: "place_details"',
    'places_timeout',
  ],
  'Corridas: busca/detalhes de endereço usam Edge Function com timeout',
);
requireMarkers(
  'src/hooks/use-destination-search.tsx',
  [
    'requestSequence',
    'placesService.cancelPendingSearch()',
    'PLACES_CONFIG.DEBOUNCE_MS',
    'setIsLoading(false)',
  ],
  'Corridas: digitação cancela busca anterior e nunca deixa spinner órfão',
);
requireMarkers(
  searchPath,
  ['data-apois-stable-destination-sheet', 'h-[78dvh]', 'query.trim().length < 3'],
  'Corridas: painel de destino mantém altura estável com teclado aberto',
);

console.log('[OK] APOIS_CORRIDAS_DESTINATION_SEARCH_EDGE_V1: busca de destino estabilizada sem alterar Maps/GPS.');
