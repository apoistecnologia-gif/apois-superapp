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

async function googleJson(url: URL) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Google Maps HTTP ${response.status}`);
  const payload = await response.json();
  if (!["OK", "ZERO_RESULTS"].includes(payload?.status)) {
    throw new Error(`Google Maps retornou ${payload?.status ?? "erro desconhecido"}`);
  }
  return payload;
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

async function nominatimReverse(lat: number, lng: number) {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR,pt");
  url.searchParams.set("zoom", "18");
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "APOIS-Entregas/1.0 (address lookup)",
    },
  });
  if (!response.ok) throw new Error(`Reverse geocoding fallback HTTP ${response.status}`);
  const payload = await response.json();
  const address = (payload?.address ?? {}) as Record<string, unknown>;
  const components = toGoogleLikeComponents(address);
  return components.length ? [{ address_components: components }] : [];
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
          const payload = await googleJson(url);
          if ((payload.results ?? []).length > 0) return json({ results: payload.results });
        } catch (googleError) {
          console.error("Google reverse geocode failed; using fallback", googleError);
        }
      }

      const fallbackResults = await nominatimReverse(lat, lng);
      return json({ results: fallbackResults, provider: "fallback" });
    }

    if (!apiKey) {
      return json({ error: "Busca textual indisponível no momento. Use sua localização atual." }, 503);
    }

    if (action === "autocomplete") {
      const input = String(body?.input ?? "").trim();
      if (input.length < 3) return json({ predictions: [] });
      const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
      url.searchParams.set("input", input);
      url.searchParams.set("components", "country:br");
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("key", apiKey);
      const payload = await googleJson(url);
      return json({ predictions: payload.predictions ?? [] });
    }

    if (action === "place_details") {
      const placeId = String(body?.placeId ?? "").trim();
      if (!placeId) return json({ error: "placeId obrigatório" }, 400);
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", placeId);
      url.searchParams.set("fields", "address_components,geometry");
      url.searchParams.set("language", "pt-BR");
      url.searchParams.set("key", apiKey);
      const payload = await googleJson(url);
      return json({ result: payload.result ?? null });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (error) {
    console.error("google-maps-address error", error);
    return json({ error: error instanceof Error ? error.message : "Erro ao consultar endereço" }, 500);
  }
});
