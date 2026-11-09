import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { getCorsHeaders } from "../_shared/cors.ts";
import { disabledRideFeatureError } from "../_shared/ride-feature-flags.ts";
import {
  findEligibleDriversForRide,
  type DispatchActiveRide,
  type DispatchDriver,
  type DispatchRide,
} from "../_shared/dispatch-engine.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OFFER_SECONDS = 30;
const SEARCH_TIMEOUT_SECONDS = 180;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), "content-type": "application/json" },
  });
}

function bearer(req: Request): string {
  return (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

async function pushOffers(ride: Record<string, unknown>, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-ride-push`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE}`,
      apikey: SERVICE_ROLE,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      user_ids: userIds,
      event: "driver.new_ride_request",
      title: "APOIS • Nova corrida disponível",
      body: "Abra o app para ver os detalhes da solicitação.",
      url: "/motorista/app",
      ride_id: text(ride.id),
    }),
  });
  if (!response.ok) {
    console.error("[dispatch-ride] push failed", response.status, await response.text());
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) return json(req, { error: "server_configuration_missing" }, 500);
    if (bearer(req) !== SERVICE_ROLE) return json(req, { error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const rideId = text(body.ride_id);
    const mode = text(body.mode).toLowerCase() === "redispatch" ? "redispatch" : "initial";
    if (!UUID_PATTERN.test(rideId)) return json(req, { error: "invalid_ride_id" }, 422);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rawRide, error: rideError } = await admin
      .from("rides")
      .select("*")
      .eq("id", rideId)
      .maybeSingle();
    if (rideError) return json(req, { error: "ride_lookup_failed", detail: rideError.message }, 500);
    if (!rawRide) return json(req, { error: "ride_not_found" }, 404);
    const featureError = await disabledRideFeatureError(admin, rawRide.category);
    if (featureError) {
      return json(req, { error: featureError, message: "Serviço temporariamente indisponível." }, 403);
    }

    if (rawRide.status !== "procurar_motorista" || rawRide.driver_id || rawRide.accepted_driver_id) {
      return json(req, { ok: true, status: rawRide.status, action: "not_dispatchable", offered: 0 });
    }

    const now = Date.now();
    const searchExpiresAt = rawRide.search_expires_at
      ? new Date(rawRide.search_expires_at).getTime()
      : new Date(rawRide.created_at).getTime() + SEARCH_TIMEOUT_SECONDS * 1000;

    if (Number.isFinite(searchExpiresAt) && searchExpiresAt <= now) {
      const { error: expireError } = await admin
        .from("rides")
        .update({
          status: "expired",
          cancellation_reason: "Nenhum motorista disponível no momento.",
          cancelled_by: "system",
          cancelled_at: new Date().toISOString(),
          candidate_driver_ids: [],
          offered_driver_ids: [],
          current_offer_driver_id: null,
          request_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rideId)
        .eq("status", "procurar_motorista")
        .is("driver_id", null);
      if (expireError) return json(req, { error: "ride_expire_failed", detail: expireError.message }, 500);
      return json(req, { ok: true, status: "expired", action: "expired", offered: 0 });
    }

    // APOIS_REPORT07_DISPATCH_CAS_V1: protect active offers even after a lost initial response.
    if (rawRide.request_expires_at) {
      const offerExpiresAt = new Date(rawRide.request_expires_at).getTime();
      const activeOfferIds = stringArray(rawRide.offered_driver_ids);
      if (Number.isFinite(offerExpiresAt) && offerExpiresAt > now && activeOfferIds.length > 0) {
        return json(req, { ok: true, status: rawRide.status, action: "offer_still_active", offered: activeOfferIds.length });
      }
    }

    const { data: driverRows, error: driversError } = await admin
      .from("drivers")
      .select("id,user_id,category,is_online,approval_status,subscription_status,current_lat,current_lng,last_location_at")
      .eq("is_online", true)
      .eq("approval_status", "aprovado");
    if (driversError) return json(req, { error: "driver_lookup_failed", detail: driversError.message }, 500);

    const drivers: DispatchDriver[] = (driverRows ?? []).map((row) => ({
      id: text(row.id),
      user_id: text(row.user_id),
      category: row.category == null ? null : text(row.category),
      is_online: row.is_online === true,
      approval_status: row.approval_status == null ? null : text(row.approval_status),
      subscription_status: row.subscription_status == null ? null : text(row.subscription_status),
      current_lat: numberOrNull(row.current_lat),
      current_lng: numberOrNull(row.current_lng),
      last_location_at: row.last_location_at == null ? null : text(row.last_location_at),
    }));

    const driverEntityIds = drivers.map((driver) => driver.id).filter(Boolean);
    let activeRows: Array<Record<string, unknown>> = [];
    let queuedRows: Array<Record<string, unknown>> = [];
    if (driverEntityIds.length > 0) {
      const activeResult = await admin
        .from("rides")
        .select("id,driver_id,status,destination_lat,destination_lng")
        .in("driver_id", driverEntityIds)
        .in("status", ["motorista_a_caminho", "motorista_chegou", "em_viagem"]);
      if (activeResult.error) return json(req, { error: "active_ride_lookup_failed", detail: activeResult.error.message }, 500);
      activeRows = (activeResult.data ?? []) as Array<Record<string, unknown>>;

      const queuedResult = await admin
        .from("rides")
        .select("driver_id")
        .in("driver_id", driverEntityIds)
        .eq("status", "procurar_motorista")
        .not("queued_after_ride_id", "is", null);
      if (queuedResult.error) return json(req, { error: "queued_ride_lookup_failed", detail: queuedResult.error.message }, 500);
      queuedRows = (queuedResult.data ?? []) as Array<Record<string, unknown>>;
    }

    const activeRides: DispatchActiveRide[] = activeRows.map((row) => ({
      id: text(row.id),
      driver_id: text(row.driver_id),
      status: text(row.status),
      destination_lat: numberOrNull(row.destination_lat),
      destination_lng: numberOrNull(row.destination_lng),
    }));

    let nextRideRadiusKm = 5;
    const { data: nextRideSetting } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "ride.next_offer_max_distance_km")
      .maybeSingle();
    const parsedRadius = Number(nextRideSetting?.value ?? 5);
    if (Number.isFinite(parsedRadius)) nextRideRadiusKm = Math.max(0.5, Math.min(parsedRadius, 20));

    const ride: DispatchRide = {
      id: text(rawRide.id),
      category: text(rawRide.category),
      origin_lat: Number(rawRide.origin_lat),
      origin_lng: Number(rawRide.origin_lng),
      candidate_driver_ids: stringArray(rawRide.candidate_driver_ids),
      offered_driver_ids: stringArray(rawRide.offered_driver_ids),
      rejected_driver_ids: stringArray(rawRide.rejected_driver_ids),
    };

    const result = findEligibleDriversForRide({
      ride,
      drivers,
      activeRides,
      queuedDriverIds: queuedRows.map((row) => text(row.driver_id)).filter(Boolean),
      options: {
        nowMs: now,
        maxGpsAgeSeconds: 120,
        maxOffers: 5,
        nextRideRadiusKm,
        remainingPoolUserIds: mode === "redispatch" ? stringArray(rawRide.candidate_driver_ids) : null,
      },
    });

    const visibleCandidateUserIds = [
      ...new Set([...result.offeredUserIds, ...result.remainingCandidateUserIds]),
    ];

    const nextOfferExpiresAt = new Date(now + OFFER_SECONDS * 1000).toISOString();
    const { data: updatedRide, error: updateError } = await admin
      .from("rides")
      .update({
        candidate_driver_ids: visibleCandidateUserIds,
        offered_driver_ids: result.offeredUserIds,
        current_offer_driver_id: null,
        request_expires_at: result.offeredUserIds.length > 0 ? nextOfferExpiresAt : new Date(now + 10_000).toISOString(),
        search_expires_at: rawRide.search_expires_at ?? new Date(now + SEARCH_TIMEOUT_SECONDS * 1000).toISOString(),
        dispatch_attempts: Number(rawRide.dispatch_attempts ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rideId)
      .eq("status", "procurar_motorista")
      .is("driver_id", null)
      .is("accepted_driver_id", null)
      .eq("dispatch_attempts", Number(rawRide.dispatch_attempts ?? 0))
      .select("id,status,origin_name,destination_name")
      .maybeSingle();

    if (updateError) return json(req, { error: "dispatch_update_failed", detail: updateError.message }, 500);
    if (!updatedRide) return json(req, { ok: true, action: "race_lost", offered: 0 });

    if (result.offeredUserIds.length > 0) {
      EdgeRuntime.waitUntil(pushOffers({ ...rawRide, ...updatedRide }, result.offeredUserIds));
    }

    return json(req, {
      ok: true,
      status: updatedRide.status,
      action: result.offeredUserIds.length > 0 ? "offered" : "no_candidate_yet",
      offered: result.offeredUserIds.length,
      remaining_candidates: result.remainingCandidateUserIds.length,
      offered_user_ids: result.offeredUserIds,
    });
  } catch (error) {
    console.error("[dispatch-ride] fatal", error);
    return json(req, { error: "internal_error" }, 500);
  }
});
