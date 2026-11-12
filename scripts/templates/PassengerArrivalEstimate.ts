import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PolylineDecoder } from "@/services/routes/polyline-decoder";
import type { ActiveRide, RideStatus } from "@/types/rides/active-ride";

// APOIS_PASSENGER_QA217_ROAD_ETA_V1 — road ETA, not straight-line speed.
// Reuse the existing authenticated passenger-routes-compute; frontend throttles
// requests to 90 seconds. Never call Maps directly or overwrite route state.
export type RoadArrivalEstimate = {
  phase: "pickup" | "destination";
  distanceMeters: number;
  minutes: number;
  points: Array<{ lat: number; lng: number }>;
  updatedAt: number;
};
const MIN_INTERVAL_MS = 90_000;
const MAX_AGE_MS = 180_000;
const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const coordinate = (p: {lat:number;lng:number}) => valid(p.lat) && valid(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;

export function usePassengerArrivalEstimate(ride: ActiveRide | null, status: RideStatus | null) {
  const [estimate, setEstimate] = useState<RoadArrivalEstimate | null>(null);
  const requestAt = useRef<{key:string;time:number}>({key:"",time:0});
  const phase = status === "motorista_a_caminho" ? "pickup" : status === "em_viagem" ? "destination" : null;
  const rideId = ride?.id ?? "";
  const latitude = ride?.driver_latitude;
  const longitude = ride?.driver_longitude;
  const pickupLat = ride?.origin.lat;
  const pickupLng = ride?.origin.lng;
  const destinationLat = ride?.destination.lat;
  const destinationLng = ride?.destination.lng;

  useEffect(() => {
    let cancelled = false;
    const key = rideId + ":" + phase;
    setEstimate((current) => current?.phase === phase && requestAt.current.key === key ? current : null);
    if (!phase || !rideId || !valid(latitude) || !valid(longitude)) return () => { cancelled = true; };
    const start = {lat:latitude,lng:longitude};
    const end = phase === "pickup" ? {lat:pickupLat,lng:pickupLng} : {lat:destinationLat,lng:destinationLng};
    if (!valid(end.lat) || !valid(end.lng) || !coordinate(start) || !coordinate({lat:end.lat,lng:end.lng})) {
      return () => { cancelled = true; };
    }

    const compute = async () => {
      if (!navigator.onLine || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (requestAt.current.key === key && now - requestAt.current.time < MIN_INTERVAL_MS) return;
      // A user-visible ETA requires a real road routing response; no fabricated speed.
      requestAt.current = {key,time:now};
      try {
        const { data, error } = await supabase.functions.invoke("passenger-routes-compute", {
          body: {origin:start,destination:{lat:end.lat,lng:end.lng},intermediates:[]},
        });
        if (cancelled) return;
        if (error) throw error;
        const response = data?.route ?? data;
        const meters = response?.distanceMeters;
        const seconds = response?.durationSeconds;
        if (!valid(meters) || meters < 0 || !valid(seconds) || seconds < 0) throw Error("invalid_route_estimate");
        let points: Array<{lat:number;lng:number}> = [];
        if (typeof response?.encodedPolyline === "string" && response.encodedPolyline.length > 0) {
          try { points = PolylineDecoder.decode(response.encodedPolyline); }
          catch { points = []; }
        }
        // A route is only considered fresh after server response.
        setEstimate({
          phase, distanceMeters:meters, minutes:Math.max(1,Math.ceil(seconds/60)),
          points:points.filter(coordinate), updatedAt:Date.now(),
        });
      } catch {
        if (!cancelled) setEstimate((previous) => previous?.phase === phase &&
          Date.now() - previous.updatedAt < MAX_AGE_MS ? previous : null);
      }
    };
    void compute();
    const pollId = window.setInterval(() => { void compute(); }, MIN_INTERVAL_MS);
    return () => { cancelled = true; window.clearInterval(pollId); };
  }, [rideId,phase,latitude,longitude,pickupLat,pickupLng,destinationLat,destinationLng]);

  if (!phase || !estimate || estimate.phase !== phase ||
      Date.now() - estimate.updatedAt > MAX_AGE_MS) return null;
  return estimate;
}
