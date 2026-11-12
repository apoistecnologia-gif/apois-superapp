// APOIS_CORRIDAS_PLACES_NEW_V1
// Server-only adapter: Google Places API (New) -> existing APOIS Places contract.
// No credentials in client bundles. No extra provider calls. Bounded timeout.
// The API key must be restricted to Geocoding API and Places API (New).
const API_URL = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 4000;
const AUTO_FIELDS = "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text";
const DETAILS_FIELDS = "location,addressComponents,formattedAddress";

async function placesNewFetch(url, apiKey, method, fieldMask, body, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      method,
      headers: {
        "Accept": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (!response.ok) {
      // Never log URL, user search text, user coordinates or the API key.
      throw new Error(`Places API (New) HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

export function normalizePlacesNewPrediction(suggestion) {
  const prediction = suggestion?.placePrediction;
  const placeId = typeof prediction?.placeId === "string" ? prediction.placeId.trim() : "";
  const description = typeof prediction?.text?.text === "string" ? prediction.text.text.trim() : "";
  if (!placeId || !description) return null;
  const primary = typeof prediction?.structuredFormat?.mainText?.text === "string"
    ? prediction.structuredFormat.mainText.text.trim() : "";
  const secondary = typeof prediction?.structuredFormat?.secondaryText?.text === "string"
    ? prediction.structuredFormat.secondaryText.text.trim() : "";
  return {
    place_id: placeId,
    description,
    structured_formatting: {
      main_text: primary || description.split(",")[0].trim(),
      secondary_text: secondary,
    },
  };
}

export async function placesNewAutocomplete(apiKey, input, lat, lng, fetchImpl = fetch) {
  const text = String(input ?? "").trim();
  if (text.length < 3) return [];
  const body = {
    input: text,
    languageCode: "pt-BR",
    regionCode: "BR",
    includedRegionCodes: ["br"],
  };
  if (typeof lat === "number" && typeof lng === "number" &&
      Number.isFinite(lat) && Number.isFinite(lng) &&
      Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    body.locationBias = {
      circle: { center: { latitude: lat, longitude: lng }, radius: 50000 },
    };
  }
  const response = await placesNewFetch(
    `${API_URL}/places:autocomplete`, apiKey, "POST", AUTO_FIELDS, body, fetchImpl,
  );
  const suggestions = Array.isArray(response?.suggestions) ? response.suggestions : [];
  return suggestions.map(normalizePlacesNewPrediction).filter(Boolean);
}

export function normalizePlacesNewDetails(place) {
  const lat = place?.location?.latitude;
  const lng = place?.location?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number" ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new Error("Places API (New) details invalid coordinates");
  }
  const components = (Array.isArray(place?.addressComponents) ? place.addressComponents : [])
    .map((part) => ({
      long_name: typeof part?.longText === "string" ? part.longText : "",
      short_name: typeof part?.shortText === "string" ? part.shortText : "",
      types: Array.isArray(part?.types) ? part.types : [],
    }))
    .filter((part) => part.long_name);
  return {
    geometry: { location: { lat, lng } },
    address_components: components,
    formatted_address: typeof place?.formattedAddress === "string" ? place.formattedAddress : "",
  };
}

export async function placesNewDetails(apiKey, placeId, fetchImpl = fetch) {
  const id = String(placeId ?? "").trim();
  if (!id || id.length > 256 || id.includes("/")) {
    throw new Error("Places API (New) details invalid place id");
  }
  const place = await placesNewFetch(
    `${API_URL}/places/${encodeURIComponent(id)}?languageCode=pt-BR&regionCode=BR`,
    apiKey, "GET", DETAILS_FIELDS, undefined, fetchImpl,
  );
  return normalizePlacesNewDetails(place);
}
