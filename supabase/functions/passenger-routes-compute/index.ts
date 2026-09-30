import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const valid = (p: any) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

async function authUser(req: Request) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authorization = req.headers.get("authorization") ?? "";
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

async function googleRoute(origin: any, destination: any, stops: any[], key: string) {
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": key,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.legs.steps.distanceMeters,routes.legs.steps.navigationInstruction,routes.legs.steps.startLocation",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      intermediates: stops.map((s) => ({ location: { latLng: { latitude: s.lat, longitude: s.lng } } })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      polylineEncoding: "ENCODED_POLYLINE",
      languageCode: "pt-BR",
      regionCode: "BR",
    }),
  });
  if (!response.ok) throw new Error("google_route_failed");
  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route?.encodedPolyline && !route?.polyline?.encodedPolyline) throw new Error("google_route_empty");
  const distanceMeters = Number(route.distanceMeters);
  const durationSeconds = Number.parseInt(String(route.duration ?? "0").replace("s", ""), 10);
  const steps = (route.legs ?? []).flatMap((leg: any) =>
    (leg.steps ?? []).map((step: any) => ({
      lat: Number(step.startLocation?.latLng?.latitude),
      lng: Number(step.startLocation?.latLng?.longitude),
      distanceMeters: Math.round(Number(step.distanceMeters ?? 0)),
      instruction: String(step.navigationInstruction?.instructions ?? "").trim(),
      maneuver: String(step.navigationInstruction?.maneuver ?? "").trim() || null,
    })),
  ).filter((step: any) => valid(step) && step.instruction);
  return {
    ok: true,
    distanceMeters,
    distanceKm: distanceMeters / 1000,
    durationSeconds,
    durationMinutes: Math.ceil(durationSeconds / 60),
    encodedPolyline: String(route.polyline?.encodedPolyline ?? route.encodedPolyline),
    provider: "google",
    steps,
  };
}

async function osrmRoute(origin: any, destination: any, stops: any[]) {
  const points = [origin, ...stops, destination].map((p) => `${p.lng},${p.lat}`).join(";");
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${points}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "polyline");
  url.searchParams.set("steps", "true");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`osrm_http_${response.status}`);
  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route?.geometry) throw new Error("osrm_route_empty");
  const distanceMeters = Math.round(Number(route.distance));
  const durationSeconds = Math.round(Number(route.duration));
  const instructionFor = (step: any) => {
    const type = String(step?.maneuver?.type ?? "");
    const modifier = String(step?.maneuver?.modifier ?? "");
    const road = String(step?.name ?? "").trim();
    const roadText = road ? ` na ${road}` : "";
    const direction =
      modifier === "left" ? "à esquerda" :
      modifier === "right" ? "à direita" :
      modifier === "slight left" ? "levemente à esquerda" :
      modifier === "slight right" ? "levemente à direita" :
      modifier === "sharp left" ? "acentuadamente à esquerda" :
      modifier === "sharp right" ? "acentuadamente à direita" :
      modifier === "uturn" ? "faça o retorno" : "em frente";

    if (type === "depart") return road ? `Siga pela ${road}` : "Siga em frente";
    if (type === "arrive") return "Você chegou ao destino";
    if (type === "roundabout" || type === "rotary") return road ? `Entre na rotatória e siga${roadText}` : "Entre na rotatória e siga a saída indicada";
    if (type === "merge") return `Acesse a via ${direction}${roadText}`;
    if (type === "fork") return `Mantenha-se ${direction}${roadText}`;
    if (type === "turn" || type === "end of road" || type === "continue" || type === "new name") {
      if (modifier === "straight") return road ? `Continue pela ${road}` : "Continue em frente";
      return `Vire ${direction}${roadText}`;
    }
    return road ? `Continue pela ${road}` : "Continue em frente";
  };

  const steps = (route.legs ?? []).flatMap((leg: any) =>
    (leg.steps ?? []).map((step: any) => ({
      lat: Number(step?.maneuver?.location?.[1]),
      lng: Number(step?.maneuver?.location?.[0]),
      distanceMeters: Math.round(Number(step?.distance ?? 0)),
      instruction: instructionFor(step),
      maneuver: [step?.maneuver?.type, step?.maneuver?.modifier].filter(Boolean).join(":") || null,
    })),
  ).filter((step: any) => valid(step) && step.instruction);

  return {
    ok: true,
    distanceMeters,
    distanceKm: distanceMeters / 1000,
    durationSeconds,
    durationMinutes: Math.ceil(durationSeconds / 60),
    encodedPolyline: String(route.geometry),
    provider: "osrm",
    steps,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);
  try {
    if (!(await authUser(req))) return json({ error: "Unauthorized" }, 401);
    const { origin, destination, stops = [] } = await req.json();
    if (!valid(origin) || !valid(destination) || !Array.isArray(stops) || stops.length > 3 || stops.some((s) => !valid(s))) {
      return json({ error: "Invalid route input" }, 400);
    }
    const key = Deno.env.get("GOOGLE_ROUTES_API_KEY")?.trim() || Deno.env.get("GOOGLE_MAPS_PLATFORM_API_KEY")?.trim() || Deno.env.get("GOOGLE_MAPS_API_KEY")?.trim();
    if (key) {
      try { return json(await googleRoute(origin, destination, stops, key)); }
      catch (error) { console.warn("[passenger-routes-compute] Google unavailable, using OSRM fallback"); }
    }
    return json(await osrmRoute(origin, destination, stops));
  } catch (error) {
    console.error("[passenger-routes-compute]", error instanceof Error ? error.message : "unknown");
    return json({ error: "Não foi possível calcular a rota agora." }, 500);
  }
});