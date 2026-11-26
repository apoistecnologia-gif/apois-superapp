import { createV21ExperimentalAction } from "./v21-edge-adapter.mjs";
import { pilotRemoteQuoteMetrics, pilotAllowed } from "./pilot-remote-quote.mjs";
import { bearerToken, createV21EdgeSession } from "./edge-session-v21.mjs";
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

async function routeMetrics(origin: any, destination: any, stops: Array<{lat:number;lng:number}> = []) {
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
          intermediates: stops.map(s => ({ location: { latLng: { latitude: s.lat, longitude: s.lng } } })),
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

  const osrmPoints = [origin, ...stops, destination].map(s => `${s.lng},${s.lat}`).join(';');
  const url = new URL(`https://router.project-osrm.org/route/v1/driving/${osrmPoints}`);
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

// APOIS_BACKEND_UNIFIED_DISPATCH_V1: all initial and retried offers use the
// same CAS/eligibility/FCM engine as driver rejection and cron recovery.
async function dispatch(ride: { id: string; candidate_driver_ids?: unknown }, requestedMode: "initial" | "redispatch" = "initial"): Promise<string[]> {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) throw new Error("dispatch_configuration_missing");
  const mode = requestedMode === "redispatch" &&
    Array.isArray(ride.candidate_driver_ids) && ride.candidate_driver_ids.length > 0
    ? "redispatch" : "initial";
  const response = await fetch(url + "/functions/v1/dispatch-ride", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      apikey: key,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ride_id: ride.id, mode }),
  });
  const payload = await response.json().catch(() => ({})) as {
    ok?: boolean; offered_user_ids?: unknown;
  };
  if (!response.ok || payload.ok !== true) {
    // Request creation has already committed; recovery scans the same row.
    throw new Error("dispatch_deferred");
  }
  // dispatch-ride owns notification delivery; never push this offer twice.
  return Array.isArray(payload.offered_user_ids)
    ? payload.offered_user_ids.filter((id): id is string => typeof id === "string").slice(0, 5)
    : [];
}

// Only the experimental quote/create path uses this extra session gate.
let experimentalVerifier:ReturnType<typeof createV21EdgeSession>|null=null;
function verifiedExperimentalSession(url:string,serviceRole:string){
 const anon=Deno.env.get("SUPABASE_ANON_KEY")??"";
 return experimentalVerifier??=createV21EdgeSession({projectUrl:url,
  sessionPolicyConfirmed:Deno.env.get("APOIS_NAVIGATION_SESSION_POLICY")==="existence-not-after-reviewed",
  authClient:createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}}),
  serviceClient:createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}})});
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

    // APOIS_NAVIGATION_LAB_V21: opt-in verified pilot, private HTTPS quote only.
    // The existing request path below is unchanged.
    if (body?.action === "apois_navigation_quote" || body?.action === "apois_navigation_create") {
      if (Deno.env.get("APOIS_NAVIGATION_EXPERIMENTAL_ENABLED") !== "true") return json({ok:false,error_code:"experimental_navigation_disabled"},409);
      if (!pilotAllowed(auth.id,Deno.env.get("APOIS_NAVIGATION_PILOT_AUTH_IDS"))) return json({ok:false,error_code:"pilot_not_allowed"},403);
      const token=bearerToken(req.headers.get("authorization"));
      if(!token)return json({ok:false,error_code:"unauthorized"},401);
      try{
        if(await verifiedExperimentalSession(url,serviceRole)(token,req.signal)!==auth.id)return json({ok:false,error_code:"unauthorized"},401);
      }catch{return json({ok:false,error_code:"session_verification_unavailable"},503);}
      const handle = createV21ExperimentalAction({
        enabled: true,
        admin, authUserId: auth.id, passengerId: userRow.id,
        independentMetrics: pilotRemoteQuoteMetrics({authUserId:auth.id,readEnv:(name:string)=>Deno.env.get(name)}),
        loadFare: (categoryId: string, category: string, km: number, min: number, details: Record<string, unknown>) =>
          loadFare(admin, categoryId, category, km, min, details),
        dispatchInitial: dispatch,
      });
      const result = await handle(body);
      return json(result.body, result.status);
    }


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
      if (ride.status !== "procurar_motorista" || ride.driver_id || ride.accepted_driver_id) {
        return json({ ok: true, rideId: ride.id, candidates: 0, status: ride.status, skipped: "status_changed" });
      }
      if (ride.search_expires_at && new Date(ride.search_expires_at).getTime() <= Date.now()) {
        return json({ ok: true, rideId: ride.id, candidates: 0, status: ride.status, skipped: "search_expired" });
      }
      if (ride.request_expires_at && new Date(ride.request_expires_at).getTime() > Date.now()) {
        return json({ ok: true, rideId: ride.id, candidates: (ride.candidate_driver_ids ?? []).length, status: ride.status, skipped: "offer_active" });
      }
      const ids = await dispatch(ride, "redispatch");
      return json({ ok: true, rideId: ride.id, candidates: ids.length, status: ride.status });
    }

    // O encerramento é responsabilidade do job privado pg_cron. Não atribuir expiração ao passageiro.
    if (!validPoint(body?.origin) || !validPoint(body?.destination)) return json({ error: "invalid_coordinates", message: "Origem ou destino inválido." }, 200);

    const paymentMethod = String(body?.payment_method ?? "").trim().toLowerCase();
    if (!["cash", "credit", "pix"].includes(paymentMethod)) {
      console.error("[request-ride] invalid payment method", {
        received: paymentMethod || "<empty>",
        auth_user_id: auth.id,
      });
      return json({
        ok: false,
        error: "invalid_payment_method",
        error_code: "invalid_payment_method",
        message: "Selecione novamente a forma de pagamento antes de solicitar a corrida.",
      }, 200);
    }

    if (paymentMethod === "pix") {
      const { data: electronicSetting, error: electronicSettingError } = await admin
        .from("app_settings")
        .select("value")
        .eq("key", "finance.ride_electronic_payments_enabled")
        .maybeSingle();
      if (electronicSettingError) throw electronicSettingError;
      const raw = electronicSetting?.value;
      const electronicEnabled =
        raw === true ||
        String(raw ?? "").trim().toLowerCase() === "true" ||
        String(raw ?? "").trim() === "1";
      if (!electronicEnabled) {
        return json({
          ok: false,
          error: "electronic_payments_disabled",
          error_code: "electronic_payments_disabled",
          message: "PIX ainda não está liberado para corridas.",
        }, 200);
      }
    }

    const category = String(body?.category ?? "").trim().toLowerCase();
    const allowed = new Set(["carros","motos","fretes","guincho","envios"]);
    if (!allowed.has(category)) return json({ error: "invalid_category" }, 422);

    const requestKey = /^[0-9a-f-]{36}$/i.test(String(body?.request_key ?? "")) ? String(body.request_key) : crypto.randomUUID();
    const { data: existing } = await admin.from("rides").select("id,status,estimated_price").eq("passenger_id", userRow.id).eq("request_key", requestKey).maybeSingle();
    if (existing) return json({ ok: true, reused: true, rideId: existing.id, status: existing.status, estimated_price: existing.estimated_price });

    const { data: categoryRow, error: categoryError } = await admin.from("ride_categories").select("id,code").eq("code", category).eq("is_active", true).maybeSingle();
    if (categoryError) throw categoryError;
    if (!categoryRow) return json({ error: "category_unavailable" }, 422);

    const intermediates = body?.intermediates ?? body?.stops ?? []; // APOIS_STOPS_BACKEND_V2
    if (!Array.isArray(intermediates) || intermediates.length > 3 || !intermediates.every(validPoint)) {
      return json({ ok: false, error: 'invalid_intermediates', message: 'Paradas inválidas. Confira os endereços.' }, 422);
    }
    const metrics = await routeMetrics(body.origin, body.destination, intermediates);
    const details = body?.service_details && typeof body.service_details === "object" && !Array.isArray(body.service_details) ? body.service_details : {};
    const estimatedPrice = await loadFare(admin, categoryRow.id, category, metrics.distanceKm, metrics.durationMin, details);
    // APOIS_PASSENGER_AUDIT_PRICE_V1: server recomputes fare; client quote is only a comparison.
    // Keep optional for legacy APK compatibility until a coordinated deployment.
    const expectedPriceCents = body?.expected_price_cents;
    const authoritativePriceCents = Math.round(estimatedPrice * 100);
    if (expectedPriceCents !== undefined) {
      if (
        typeof expectedPriceCents !== "number" ||
        !Number.isSafeInteger(expectedPriceCents) ||
        expectedPriceCents <= 0
      ) {
        return json({
          ok: false, error_code: "invalid_expected_price",
          message: "Valor de confirmação inválido.",
        }, 422);
      }
      if (expectedPriceCents !== authoritativePriceCents) {
        return json({
          ok: false, error_code: "price_changed",
          message: "O valor da corrida mudou. Revise o preço antes de confirmar.",
          estimated_price: estimatedPrice,
          fare_amount_cents: authoritativePriceCents,
        }, 409);
      }
    }

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
      payment_method: paymentMethod,
      payment_status: "pending",
      payment_provider: null,
      provider_payment_id: null,
      service_details: details,
      intermediates,
      request_key: requestKey,
      pickup_label: body?.pickup_label ?? null,
      pickup_short_label: body?.pickup_short_label ?? null,
      pickup_address: body?.pickup_address ?? null,
      pickup_place_id: body?.pickup_place_id ?? null,
      pickup_source: body?.pickup_source ?? "gps",
      search_expires_at: new Date(Date.now()+180000).toISOString(),
    }).select("*").single();

    if (insertError || !ride) throw insertError ?? new Error("ride_insert_failed");
    const ids = await dispatch(ride).catch((error) => {
      console.error("[request-ride] initial dispatch deferred", error instanceof Error ? error.name : "unknown");
      return [] as string[];
    });

    return json({
      ok: true,
      rideId: ride.id,
      status: ride.status,
      candidates: ids.length,
      estimated_price: estimatedPrice,
      // C-001: os caminhos de reutilização já devolviam esta chave; a criação não.
      // Mantida a mesma forma para que Cliente, Motorista e Admin leiam o valor
      // oficial sem depender de um segundo round-trip de Realtime.
      fare_amount_cents: Math.round(estimatedPrice * 100),
      payment_status: "pending",
    });
  } catch (error) {
    const failure =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack ?? null }
        : (error && typeof error === "object")
          ? {
              code: "code" in error ? String((error as any).code ?? "") : "",
              message: "message" in error ? String((error as any).message ?? "") : "",
              details: "details" in error ? String((error as any).details ?? "") : "",
              hint: "hint" in error ? String((error as any).hint ?? "") : "",
            }
          : { message: String(error ?? "unknown") };

    console.error("[request-ride] failure", JSON.stringify(failure));
    return json({
      ok: false,
      error: "internal_error",
      error_code: "request_ride_internal_error",
      message: "Não foi possível solicitar a corrida agora.",
    }, 500);
  }
});