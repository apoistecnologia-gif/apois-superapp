import { normalizeRideCategory } from "./ride-request.ts";

export type DispatchDriver = {
  id: string;
  user_id: string;
  category: string | null;
  is_online: boolean;
  approval_status: string | null;
  subscription_status: string | null;
  current_lat: number | null;
  current_lng: number | null;
  last_location_at: string | null;
};

export type DispatchActiveRide = {
  id: string;
  driver_id: string;
  status: string;
  destination_lat: number | null;
  destination_lng: number | null;
};

export type DispatchRide = {
  id: string;
  category: string;
  origin_lat: number;
  origin_lng: number;
  candidate_driver_ids?: string[] | null;
  offered_driver_ids?: string[] | null;
  rejected_driver_ids?: string[] | null;
};

export type DispatchCandidate = {
  driverId: string;
  userId: string;
  distanceKm: number;
  mode: "idle" | "next";
};

export type DispatchResult = {
  eligible: DispatchCandidate[];
  offeredUserIds: string[];
  remainingCandidateUserIds: string[];
};

export type DispatchOptions = {
  nowMs?: number;
  maxGpsAgeSeconds?: number;
  radiiKm?: number[];
  maxOffers?: number;
  nextRideRadiusKm?: number;
  /**
   * When set, redispatch is restricted to the previously persisted remaining
   * candidate pool. This prevents repeatedly offering the same driver without
   * adding another historical-ID column to the live schema.
   */
  remainingPoolUserIds?: string[] | null;
};

function finite(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

export function findEligibleDriversForRide(args: {
  ride: DispatchRide;
  drivers: DispatchDriver[];
  activeRides: DispatchActiveRide[];
  queuedDriverIds: string[];
  options?: DispatchOptions;
}): DispatchResult {
  const { ride, drivers, activeRides, queuedDriverIds } = args;
  const options = args.options ?? {};
  const nowMs = options.nowMs ?? Date.now();
  const maxGpsAgeSeconds = options.maxGpsAgeSeconds ?? 120;
  const radiiKm = options.radiiKm ?? [3, 5, 8, 12, 20, 30, 50];
  const maxOffers = Math.max(1, options.maxOffers ?? 5);
  const nextRideRadiusKm = Math.max(0.5, Math.min(options.nextRideRadiusKm ?? 5, 20));
  const category = normalizeRideCategory(ride.category);
  if (!category) return { eligible: [], offeredUserIds: [], remainingCandidateUserIds: [] };

  const originLat = finite(ride.origin_lat);
  const originLng = finite(ride.origin_lng);
  if (originLat == null || originLng == null) {
    return { eligible: [], offeredUserIds: [], remainingCandidateUserIds: [] };
  }

  const rejected = new Set((ride.rejected_driver_ids ?? []).map(String));
  const currentlyOffered = new Set((ride.offered_driver_ids ?? []).map(String));
  const remainingPool = options.remainingPoolUserIds == null
    ? null
    : new Set(options.remainingPoolUserIds.map(String));
  const queued = new Set(queuedDriverIds.map(String));
  const activeByDriver = new Map(activeRides.map((active) => [String(active.driver_id), active]));

  const eligible: DispatchCandidate[] = [];

  for (const driver of drivers) {
    const driverId = String(driver.id ?? "");
    const userId = String(driver.user_id ?? "");
    if (!driverId || !userId) continue;
    if (rejected.has(userId) || currentlyOffered.has(userId)) continue;
    if (remainingPool && !remainingPool.has(userId)) continue;
    if (driver.is_online !== true) continue;
    if (String(driver.approval_status ?? "").toLowerCase() !== "aprovado") continue;
    if (!["active", "ativa", "teste"].includes(String(driver.subscription_status ?? "").toLowerCase())) continue;
    if (normalizeRideCategory(driver.category) !== category) continue;

    const lastLocationAt = driver.last_location_at
      ? new Date(driver.last_location_at).getTime()
      : Number.NaN;
    if (!Number.isFinite(lastLocationAt)) continue;
    const gpsAgeSeconds = (nowMs - lastLocationAt) / 1000;
    if (gpsAgeSeconds < -30 || gpsAgeSeconds > maxGpsAgeSeconds) continue;

    const currentRide = activeByDriver.get(driverId);
    if (currentRide?.status === "motorista_a_caminho" || currentRide?.status === "motorista_chegou") continue;

    if (currentRide?.status === "em_viagem") {
      if (queued.has(driverId)) continue;
      const destinationLat = finite(currentRide.destination_lat);
      const destinationLng = finite(currentRide.destination_lng);
      if (destinationLat == null || destinationLng == null) continue;
      const distanceKm = haversineKm(
        { lat: originLat, lng: originLng },
        { lat: destinationLat, lng: destinationLng },
      );
      if (distanceKm <= nextRideRadiusKm) {
        eligible.push({ driverId, userId, distanceKm, mode: "next" });
      }
      continue;
    }

    const lat = finite(driver.current_lat);
    const lng = finite(driver.current_lng);
    if (lat == null || lng == null) continue;
    eligible.push({
      driverId,
      userId,
      distanceKm: haversineKm({ lat: originLat, lng: originLng }, { lat, lng }),
      mode: "idle",
    });
  }

  eligible.sort((a, b) => a.distanceKm - b.distanceKm || a.userId.localeCompare(b.userId));

  const idle = eligible.filter((candidate) => candidate.mode === "idle");
  const next = eligible.filter((candidate) => candidate.mode === "next");
  let nearbyIdle: DispatchCandidate[] = [];
  for (const radiusKm of radiiKm) {
    nearbyIdle = idle.filter((candidate) => candidate.distanceKm <= radiusKm);
    if (nearbyIdle.length > 0) break;
  }

  const offerPool = [...nearbyIdle, ...next]
    .sort((a, b) => a.distanceKm - b.distanceKm || a.userId.localeCompare(b.userId));
  const offered = offerPool.slice(0, maxOffers);
  const offeredSet = new Set(offered.map((candidate) => candidate.userId));

  return {
    eligible,
    offeredUserIds: offered.map((candidate) => candidate.userId),
    remainingCandidateUserIds: eligible
      .filter((candidate) => !offeredSet.has(candidate.userId))
      .map((candidate) => candidate.userId),
  };
}
