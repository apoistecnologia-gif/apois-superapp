import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function consumeLookupQuota(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim();
  const authorization = req.headers.get("authorization")?.trim();

  if (!supabaseUrl || !anonKey || !authorization) {
    console.error("google-maps-address quota check unavailable: missing Supabase runtime credentials or authorization");
    return { allowed: false, status: 401, error: "Autenticação necessária" };
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/consume_google_maps_lookup_quota`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      authorization,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("google-maps-address quota RPC failed", response.status, detail.slice(0, 500));
    return { allowed: false, status: 503, error: "Não foi possível validar o limite de consultas. Tente novamente." };
  }

  const payload = await response.json().catch(() => false);
  const allowed = payload === true || (Array.isArray(payload) && payload[0] === true);
  if (!allowed) {
    return { allowed: false, status: 429, error: "Muitas consultas de endereço. Aguarde um minuto e tente novamente." };
  }

  return { allowed: true, status: 200, error: "" };
}

// APOIS_GEOCODE_SERVER_TIMEOUT_V1: bounded Google lookup. If Maps is unavailable,
// do not hold the passenger's 12s address budget while waiting for the fallback.
// No added Google requests, changed credentials, or client-side API exposure.
const GOOGLE_LOOKUP_TIMEOUT_MS = 2400;
async function googleJson(url: URL, timeoutMs = 0) {
  // Only reverse_geocode opts in to the short deadline. Keep existing
  // autocomplete/place_details behavior unchanged.
  const controller = timeoutMs > 0 ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      ...(controller ? { signal: controller.signal } : {}),
    });
    if (!response.ok) throw new Error(`Google Maps HTTP ${response.status}`);
    const payload = await response.json();
    if (!["OK", "ZERO_RESULTS"].includes(payload?.status)) {
      throw new Error(`Google Maps retornou ${payload?.status ?? "erro desconhecido"}`);
    }
    return payload;
  } finally {
    if (timeout !== null) clearTimeout(timeout);
  }
}

function toGoogleLikeComponents(address: Record<string, unknown>) {
  const components: Array<{ long_name: string; short_name: string; types: string[] }> = [];
  const add = (value: unknown, types: string[], shortValue?: unknown) => {
    const text = String(value ?? "").trim();
    if (!text) return;
    components.push({
      long_name: text,
      short_name: String(shortValue ?? text).trim(),
      types,
    });
  };

  add(address.road ?? address.pedestrian ?? address.residential ?? address.footway, ["route"]);
  add(address.house_number, ["street_number"]);
  add(address.suburb ?? address.neighbourhood ?? address.quarter ?? address.city_district, ["sublocality_level_1", "political"]);
  add(address.city ?? address.town ?? address.village ?? address.municipality, ["locality", "political"]);
  add(address.county, ["administrative_area_level_2", "political"]);
  add(address.state, ["administrative_area_level_1", "political"], address["ISO3166-2-lvl4"] ? String(address["ISO3166-2-lvl4"]).split("-").pop() : address.state);
  add(address.postcode, ["postal_code"]);
  add(address.country, ["country", "political"], address.country_code ? String(address.country_code).toUpperCase() : address.country);
  return components;
}

const photonHeaders = { Accept: "application/json" };

// Retry ONCE only for transient transport/5xx errors from the existing
// Photon endpoint. Each reverse request is limited to 3s, keeping the
// combined Google + fallback worst-case under the passenger's 12s deadline.
// Never use paid Google APIs as additional fallback, and never retry 429/403.
// APOIS_PHOTON_REVERSE_TRANSIENT_RETRY_V1
async function fetchPhotonReverseJson(url: URL) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(url, { headers: photonHeaders, signal: controller.signal });
      if (response.status === 429 || response.status === 403) {
        throw new Error("Photon access temporarily restricted");
      }
      if (!response.ok && response.status < 500) {
        throw new Error("Photon reverse refused request");
      }
      if (response.ok) return await response.json();
    } catch (error) {
      if (error instanceof Error && /Photon (access temporarily restricted|reverse refused request)/.test(error.message)) {
        throw error;
      }
      if (attempt === 1) throw new Error("Photon reverse transport unavailable");
    } finally {
      clearTimeout(timeout);
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Photon reverse temporarily unavailable");
}

async function nominatimReverse(lat: number, lng: number) {
  const url = new URL("https://photon.komoot.io/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  const payload = await fetchPhotonReverseJson(url);
  const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
  if (!feature) return [];
  const p = (feature.properties ?? {}) as Record<string, unknown>;
  const address = {
    road: p.street,
    house_number: p.housenumber,
    neighbourhood: p.district ?? p.locality,
    city: p.city ?? p.town ?? p.village,
    county: p.county,
    state: p.state,
    postcode: p.postcode,
    country: p.country,
    country_code: p.countrycode,
  };
  const components = toGoogleLikeComponents(address);
  return [{
    formatted_address: [p.name, p.street, p.city ?? p.town ?? p.village, p.state, p.country].filter(Boolean).join(", "),
    address_components: components,
  }];
}

// APOIS_PHOTON_AUTOCOMPLETE_TRANSIENT_RETRY_V1
// Bound to the existing public Photon endpoint: 1 retry max, 4s per request.
// Do not retry provider 403/429 or trigger any additional paid Maps requests.
async function fetchPhotonSearchJson(url: URL) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(url, { headers: photonHeaders, signal: controller.signal });
      if (response.status === 429 || response.status === 403) {
        throw new Error("Photon autocomplete access restricted");
      }
      if (!response.ok && response.status < 500) {
        throw new Error("Photon autocomplete refused request");
      }
      if (response.ok) return await response.json();
    } catch (error) {
      if (error instanceof Error && /Photon autocomplete (access restricted|refused request)/.test(error.message)) throw error;
      if (attempt === 1) throw new Error("Photon autocomplete temporarily unavailable");
    } finally {
      clearTimeout(timeout);
    }
    if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Photon autocomplete unavailable");
}

async function nominatimSearch(input: string, lat?: number, lng?: number) {
  const url = new URL("https://photon.komoot.io/api/");
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  url.searchParams.set(
    "q",
    hasLocation ? input : `${input}, Petrolina, Pernambuco, Brasil`,
  );
  url.searchParams.set("limit", "8");
  url.searchParams.set("countrycode", "BR");
  if (hasLocation) {
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("zoom", "13");
    url.searchParams.set("location_bias_scale", "0.05");
  }
  const payload = await fetchPhotonSearchJson(url);
  const features = Array.isArray(payload?.features) ? payload.features : [];
  return features.map((feature: any) => {
    const lng = Number(feature?.geometry?.coordinates?.[0]);
    const lat = Number(feature?.geometry?.coordinates?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const p = (feature?.properties ?? {}) as Record<string, unknown>;
    const mainText = String(p.name ?? p.street ?? p.city ?? input).trim();
    const secondary = [p.street !== mainText ? p.street : null, p.city ?? p.town ?? p.village, p.state, p.country].filter(Boolean).join(", ");
    return {
      place_id: `nominatim:${lat},${lng}`,
      description: [mainText, secondary].filter(Boolean).join(", "),
      structured_formatting: { main_text: mainText, secondary_text: secondary || null },
    };
  }).filter(Boolean);
}

function parseNominatimPlaceId(placeId: string) {
  const match = /^nominatim:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(placeId);
  if (!match) return null;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  try {
    const quota = await consumeLookupQuota(req);
    if (!quota.allowed) return json({ error: quota.error }, quota.status);

    const body = await req.json();
    const action = String(body?.action ?? "");
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY")?.trim();

    if (action === "reverse_geocode") {
      const lat = Number(body?.lat);
      const lng = Number(body?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return json({ error: "Coordenadas inválidas" }, 400);

      if (apiKey) {
        try {
          const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
          url.searchParams.set("latlng", `${lat},${lng}`);
          url.searchParams.set("language", "pt-BR");
          url.searchParams.set("region", "br");
          url.searchParams.set("key", apiKey);
          const payload = await googleJson(url, GOOGLE_LOOKUP_TIMEOUT_MS);
          if ((payload.results ?? []).length > 0) return json({ results: payload.results, provider: "google" });
        } catch (googleError) {
          console.error("Google reverse geocode failed; using fallback", googleError);
        }
      }

      try {
        const fallbackResults = await nominatimReverse(lat, lng);
        return json({ results: fallbackResults, provider: "nominatim" });
      } catch {
        // Avoid leaking the passenger's precise lat/lng inside an exception URL.
        console.error("Photon reverse geocoder unavailable after bounded retry");
        return json({ error: "Serviço de endereços temporariamente indisponível. Tente novamente." }, 503);
      }
    }

    if (action === "autocomplete") {
      const input = String(body?.input ?? "").trim();
      if (input.length < 3) return json({ predictions: [] });

      const localityHint = String(body?.localityHint ?? "").trim();
      const lat = Number(body?.lat);
      const lng = Number(body?.lng);
      const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
      const localizedInput = localityHint ? `${input}, ${localityHint}` : input;

      if (apiKey) {
        try {
          const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
          url.searchParams.set("input", localizedInput);
          url.searchParams.set("components", "country:br");
          url.searchParams.set("language", "pt-BR");
          if (hasLocation) {
            url.searchParams.set("location", `${lat},${lng}`);
            url.searchParams.set("radius", "50000");
            url.searchParams.set("strictbounds", "true");
          }
          url.searchParams.set("key", apiKey);
          const payload = await googleJson(url);
          if ((payload.predictions ?? []).length > 0) return json({ predictions: payload.predictions, provider: "google" });
        } catch (googleError) {
          console.error("Google autocomplete failed; using fallback", googleError);
        }
      }

      try {
        const predictions = await nominatimSearch(localizedInput, lat, lng);
        return json({ predictions, provider: "nominatim" });
      } catch {
        // Do not leak the typed address or the passenger's coordinates in provider URLs.
        console.error("Photon autocomplete unavailable after bounded retry");
        return json({ error: "Serviço de sugestões temporariamente indisponível. Tente novamente." }, 503);
      }
    }

    if (action === "place_details") {
      const placeId = String(body?.placeId ?? "").trim();
      if (!placeId) return json({ error: "placeId obrigatório" }, 400);

      const fallbackPoint = parseNominatimPlaceId(placeId);
      if (fallbackPoint) {
        const results = await nominatimReverse(fallbackPoint.lat, fallbackPoint.lng);
        return json({
          result: {
            geometry: { location: fallbackPoint },
            address_components: results[0]?.address_components ?? [],
          },
          provider: "nominatim",
        });
      }

      if (!apiKey) return json({ error: "Não foi possível abrir os detalhes deste endereço." }, 503);
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("fields", "address_components,geometry");
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("key", apiKey);
      const payload = await googleJson(url);
      return json({ result: payload.result ?? null, provider: "google" });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("google-maps-address error", error);
    return json({ error: "Não foi possível consultar o endereço agora. Tente novamente." }, 500);
  }
});
