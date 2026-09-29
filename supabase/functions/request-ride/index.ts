import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const validPoint = (p: any) =>
  p && finite(p.lat) && finite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
const rounded = (n: number) => Math.round(n * 100) / 100;

function haversineKm(a: any, b: any) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
  const aa = s1*s1 + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*s2*s2;
  return 2 * R * Math.asin(Math.sqrt(aa));
}

async function authUser(req: Request) {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authorization = req.headers.get("authorization") ?? "";
  const client = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

async function routeMetrics(origin: any, destination: any) {
  const key =
    Deno.env.get("GOOGLE_ROUTES_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_MAPS_PLATFORM_API_KEY")?.trim() ||
    Deno.env.get("GOOGLE_MAPS_API_KEY")?.trim();

  if (key) {
    try {
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "X-Goog-Api-Key": key,
          "Content-Type": "application/json",
          "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
          polylineEncoding: "ENCODED_POLYLINE",
          languageCode: "pt-BR",
          regionCode: "BR",
        }),
      });
      if (response.ok) {
        const payload = await response.json();
        const route = payload?.routes?.[0];
        const distanceMeters = Number(route?.distanceMeters);
        const durationSeconds = Number.parseInt(String(route?.duration ?? "0s").replace("s", ""), 10);
        if (Number.isFinite(distanceMeters) && distanceMeters > 0 && Number.isFinite(durationSeconds) && durationSeconds > 0) {
          return {
            distanceKm: rounded(distanceMeters / 1000),
            durationMin: Math.max(1, Math.ceil(durationSeconds / 60)),
            encodedPolyline: String(route?.polyline?.encodedPolyline ?? ""),
          };
        }
      }
    } catch {}
  }

  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "polyline");
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("route_unavailable");
  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (!route) throw new Error("route_unavailable");
  return {
    distanceKm: rounded(Number(route.distance) / 1000),
    durationMin: Math.max(1, Math.ceil(Number(route.duration) / 60)),
    encodedPolyline: String(route.geometry ?? ""),
  };
}

function extraFare(category: string, tariff: Record<string, number>, details: Record<string, unknown>) {
  const yes = (v: unknown) => v === true || ["sim","yes","true","1"].includes(String(v ?? "").trim().toLowerCase());
  const num = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : 0; };
  let extras = 0;
  if (category === "fretes") {
    if (details.ajudantes === "um") extras += tariff.helper1_fee ?? 0;
    if (details.ajudantes === "dois") extras += tariff.helper2_fee ?? 0;
    if (yes(details.itemPesado)) extras += tariff.heavy_furniture_fee ?? 0;
    if (yes(details.desmontar)) extras += tariff.assembly_fee ?? 0;
    if (yes(details.embalar)) extras += tariff.packing_fee ?? 0;
  }
  if (category === "guincho") {
    if (["utilitario","caminhonete"].includes(String(details.tipoVeiculo))) extras += tariff.heavy_vehicle_fee ?? 0;
    if (yes(details.dificilAcesso)) extras += tariff.difficult_access_fee ?? 0;
    if (yes(details.acidente)) extras += tariff.accident_fee ?? 0;
    if (yes(details.precisaPlataforma)) extras += tariff.platform_fee ?? 0;
    if (yes(details.rodasTravadas)) extras += tariff.locked_wheels_fee ?? 0;
    if (yes(details.garagemSubsolo)) extras += tariff.garage_fee ?? 0;
  }
  if (category === "envios") {
    const weight = num(details.weightKg);
    const max = tariff.max_weight_kg ?? 0;
    if (max > 0 && weight > max) throw new Error("service_weight_exceeds_limit");
    extras += weight * (tariff.per_kg ?? 0);
  }
  return extras;
}

async function loadFare(admin: any, categoryId: string, category: string, km: number, min: number, details: Record<string, unknown>) {
  const { data: rules, error } = await admin
    .from("tariff_rules")
    .select("*")
    .eq("category_id", categoryId)
    .eq("is_active", true);
  if (error) throw error;
  const candidates = rules ?? [];
  const rule =
    candidates.find((r: any) => String(r.city ?? "").trim().toLowerCase() === "petrolina") ??
    candidates.find((r: any) => !String(r.city ?? "").trim()) ??
    candidates[0];
  if (!rule) throw new Error("tariff_not_found");

  const fields = [
    "base_fare","min_fare","per_km","per_min","helper1_fee","helper2_fee","heavy_furniture_fee",
    "assembly_fee","packing_fee","difficult_access_fee","stair_fee","heavy_vehicle_fee","accident_fee",
    "platform_fee","locked_wheels_fee","garage_fee","max_weight_kg","per_kg"
  ];
  const tariff: Record<string, number> = {};
  for (const key of fields) {
    const n = Number(rule[key]);
    if (Number.isFinite(n)) tariff[key] = n;
  }
  const baseRaw = (category === "guincho" ? (tariff.base_fare ?? 0) : (tariff.base_fare ?? 0))
    + (tariff.per_km ?? 0) * km + (tariff.per_min ?? 0) * min;
  const base = Math.max(tariff.min_fare ?? 0, baseRaw);
  const total = rounded(base + extraFare(category, tariff, details));
  if (!(total > 0)) throw new Error("tariff_invalid");
  return total;
}

async function dispatch(admin: any, ride: any) {
  const { data: drivers, error } = await admin
    .from("drivers")
    .select("id,user_id,category,is_online,approval_status,current_lat,current_lng,last_location_at");
  if (error) throw error;
  const origin = { lat: Number(ride.origin_lat), lng: Number(ride.origin_lng) };
  const now = Date.now();
  const candidates = (drivers ?? [])
    .filter((d: any) => d.is_online === true && d.approval_status === "aprovado")
    .filter((d: any) => String(d.category ?? "").trim().toLowerCase() === String(ride.category).trim().toLowerCase())
    .filter((d: any) => finite(Number(d.current_lat)) && finite(Number(d.current_lng)))
    .filter((d: any) => !d.last_location_at || now - new Date(d.last_location_at).getTime() <= 120000)
    .map((d: any) => ({ id: String(d.user_id), km: haversineKm(origin, { lat: Number(d.current_lat), lng: Number(d.current_lng) }) }))
    .filter((d: any) => d.km <= 50)
    .sort((a: any,b: any) => a.km-b.km)
    .slice(0, 20);

  const ids = candidates.map((d: any) => d.id);
  if (ids.length) {
    await admin.from("rides").update({
      candidate_driver_ids: ids,
      offered_driver_ids: ids,
      dispatch_attempts: 1,
      request_expires_at: new Date(Date.now()+60000).toISOString(),
    }).eq("id", ride.id);
  }
  return ids;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const auth = await authUser(req);
    if (!auth) return json({ error: "unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: userRow, error: userError } = await admin
      .from("users")
      .select("id,blocked_at,suspended_until,deleted_at")
      .eq("auth_user_id", auth.id)
      .maybeSingle();
    if (userError) throw userError;
    if (!userRow || userRow.deleted_at) return json({ error: "passenger_not_found" }, 404);
    if (userRow.blocked_at) return json({ error: "passenger_blocked" }, 403);
    if (userRow.suspended_until && new Date(userRow.suspended_until).getTime() > Date.now()) return json({ error: "passenger_suspended" }, 403);

    const { data: wallet } = await admin
      .from("passenger_wallets")
      .select("is_blocked,blocked_reason")
      .eq("passenger_id", userRow.id)
      .maybeSingle();
    if (wallet?.is_blocked) return json({ error: "passenger_debt_block", reason: wallet.blocked_reason }, 403);

    const body = await req.json();

    if (body?.action === "cancel") {
      const rideId = String(body?.ride_id ?? "").trim();
      if (!rideId) return json({ ok: false, error: "invalid_ride_id" }, 422);

      const { data: ride, error: rideError } = await admin
        .from("rides")
        .select("id,status,passenger_id")
        .eq("id", rideId)
        .eq("passenger_id", userRow.id)
        .maybeSingle();
      if (rideError) throw rideError;
      if (!ride) return json({ ok: false, error: "ride_not_found" }, 404);

      const status = String(ride.status ?? "");
      if (["finalizada","cancelada_passageiro","cancelada_motorista"].includes(status)) {
        return json({ ok: true, status, cancellation_fee: 0 });
      }
      if (!["procurar_motorista","motorista_a_caminho","agendada"].includes(status)) {
        return json({ ok: false, error: "cancellation_not_allowed", status }, 409);
      }

      const now = new Date().toISOString();
      const { data: cancelled, error: cancelError } = await admin
        .from("rides")
        .update({
          status: "cancelada_passageiro",
          cancelled_by: String(userRow.id),
          cancellation_reason: "Cancelada pelo passageiro",
          cancellation_fee: 0,
          cancelled_at: now,
          updated_at: now,
          candidate_driver_ids: [],
          offered_driver_ids: [],
          request_expires_at: null,
          search_expires_at: null,
        })
        .eq("id", rideId)
        .eq("passenger_id", userRow.id)
        .in("status", ["procurar_motorista","motorista_a_caminho","agendada"])
        .select("id,status,cancellation_fee")
        .maybeSingle();
      if (cancelError) throw cancelError;
      if (!cancelled) return json({ ok: false, error: "ride_status_changed" }, 409);

      return json({
        ok: true,
        status: "cancelada_passageiro",
        cancellation_fee: 0,
        message: "Corrida cancelada sem taxa.",
      });
    }

    if (body?.action === "redispatch") {
      const rideId = String(body?.ride_id ?? "");
      const { data: ride } = await admin.from("rides").select("*").eq("id", rideId).eq("passenger_id", userRow.id).maybeSingle();
      if (!ride) return json({ error: "ride_not_found" }, 404);
      const ids = await dispatch(admin, ride);
      return json({ ok: true, rideId: ride.id, candidates: ids.length, status: ride.status });
    }

    // Expire stale searching rides before accepting a new request. Reinstalling
    // the app must not resurrect a search that already timed out server-side.
    const staleCutoff = new Date().toISOString();
    await admin
      .from("rides")
      .update({
        status: "cancelada_passageiro",
        cancellation_reason: "Busca expirada sem motorista",
        cancelled_at: staleCutoff,
        updated_at: staleCutoff,
        candidate_driver_ids: [],
        offered_driver_ids: [],
        request_expires_at: null,
      })
      .eq("passenger_id", userRow.id)
      .eq("status", "procurar_motorista")
      .lt("search_expires_at", staleCutoff);

    if (!validPoint(body?.origin) || !validPoint(body?.destination)) return json({ error: "invalid_coordinates" }, 422);
    const category = String(body?.category ?? "").trim().toLowerCase();
    const allowed = new Set(["carros","motos","fretes","guincho","envios"]);
    if (!allowed.has(category)) return json({ error: "invalid_category" }, 422);

    const requestKey = /^[0-9a-f-]{36}$/i.test(String(body?.request_key ?? "")) ? String(body.request_key) : crypto.randomUUID();
    const { data: existing } = await admin.from("rides").select("id,status,estimated_price").eq("passenger_id", userRow.id).eq("request_key", requestKey).maybeSingle();
    if (existing) return json({ ok: true, reused: true, rideId: existing.id, status: existing.status, estimated_price: existing.estimated_price });

    const { data: categoryRow, error: categoryError } = await admin.from("ride_categories").select("id,code").eq("code", category).eq("is_active", true).maybeSingle();
    if (categoryError) throw categoryError;
    if (!categoryRow) return json({ error: "category_unavailable" }, 422);

    const metrics = await routeMetrics(body.origin, body.destination);
    const details = body?.service_details && typeof body.service_details === "object" && !Array.isArray(body.service_details) ? body.service_details : {};
    const estimatedPrice = await loadFare(admin, categoryRow.id, category, metrics.distanceKm, metrics.durationMin, details);

    const { data: ride, error: insertError } = await admin.from("rides").insert({
      passenger_id: userRow.id,
      category,
      status: "procurar_motorista",
      origin: body.origin,
      destination: body.destination,
      origin_lat: body.origin.lat,
      origin_lng: body.origin.lng,
      destination_lat: body.destination.lat,
      destination_lng: body.destination.lng,
      origin_name: String(body?.origin_name ?? "Origem"),
      destination_name: String(body?.destination_name ?? "Destino"),
      encoded_polyline: metrics.encodedPolyline || null,
      estimated_price: estimatedPrice,
      fare_amount_cents: Math.round(estimatedPrice * 100),
      distance_km: metrics.distanceKm,
      duration_min: metrics.durationMin,
      payment_method: String(body?.payment_method ?? "").trim() || null,
      payment_status: "pending",
      payment_provider: null,
      provider_payment_id: null,
      service_details: details,
      request_key: requestKey,
      pickup_label: body?.pickup_label ?? null,
      pickup_short_label: body?.pickup_short_label ?? null,
      pickup_address: body?.pickup_address ?? null,
      pickup_place_id: body?.pickup_place_id ?? null,
      pickup_source: body?.pickup_source ?? "gps",
      search_expires_at: new Date(Date.now()+180000).toISOString(),
    }).select("*").single();

    if (insertError || !ride) throw insertError ?? new Error("ride_insert_failed");
    const ids = await dispatch(admin, ride).catch(() => []);

    return json({
      ok: true,
      rideId: ride.id,
      status: ride.status,
      candidates: ids.length,
      estimated_price: estimatedPrice,
      payment_status: "pending",
    });
  } catch (error) {
    console.error("[request-ride]", error instanceof Error ? error.message : "unknown");
    return json({ error: "internal_error", message: "Não foi possível solicitar a corrida agora." }, 500);
  }
});