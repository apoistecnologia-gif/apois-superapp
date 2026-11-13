import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// APOIS_PASSENGER_QA219_AUTO_PRESENCE_V1
// Home is map-only; aggregated foreground presence starts for authenticated
// users unless they have disabled it in Perfil > Privacidade da região.
// The RPC returns no exact passenger location or identity to drivers.
type Props = {
  authUserId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  showControl?: boolean | undefined; // retained for compatibility; no overlay
};
type PresenceRpc = {
  rpc: (
    name: "apois_passenger_presence_ping" | "apois_passenger_presence_stop",
    args?: { _lat: number; _lng: number },
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};
const presenceApi = () => supabase as unknown as PresenceRpc;
const preferenceKey = (id: string) => "apois:passenger:demand-consent:" + id;

const isValidCoordinate = (lat: number | undefined, lng: number | undefined) =>
  typeof lat === "number" && typeof lng === "number" &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -35 && lat <= 6 && lng >= -74 && lng <= -32;

function readSharingPreference(authUserId: string): boolean {
  try {
    // Automatically enabled for a logged-in passenger. Explicit opt-out wins.
    // A previous explicit enable ("1") remains supported.
    return localStorage.getItem(preferenceKey(authUserId)) !== "0";
  } catch {
    // If the choice cannot be persisted, fail closed instead of ignoring opt-out.
    return false;
  }
}

export function PassengerDemandSharing({ authUserId, latitude, longitude }: Props) {
  const [enabled, setEnabled] = useState(false);
  const cellLat = typeof latitude === "number" && Number.isFinite(latitude)
    ? Number(latitude.toFixed(2)) : undefined;
  const cellLng = typeof longitude === "number" && Number.isFinite(longitude)
    ? Number(longitude.toFixed(2)) : undefined;

  useEffect(() => {
    setEnabled(authUserId ? readSharingPreference(authUserId) : false);
  }, [authUserId]);

  useEffect(() => {
    if (!enabled || !authUserId) return;
    let disposed = false;
    let pending: Promise<void> = Promise.resolve();

    const stop = () => {
      pending = pending.then(async () => {
        try { await presenceApi().rpc("apois_passenger_presence_stop"); }
        catch { /* shared region expires server-side after two minutes */ }
      });
    };

    const send = () => {
      if (!isValidCoordinate(cellLat, cellLng) ||
          !navigator.onLine || document.visibilityState !== "visible") return;
      pending = pending.then(async () => {
        if (disposed || !navigator.onLine || document.visibilityState !== "visible") return;
        try {
          await presenceApi().rpc("apois_passenger_presence_ping", {
            _lat: cellLat!, _lng: cellLng!,
          });
        } catch {
          // A failed server acknowledgement never manufactures a hotspot.
        }
      });
    };

    send();
    const timer = window.setInterval(send, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop();
      else send();
    };
    const onOnline = () => send();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      stop();
    };
  }, [authUserId, enabled, cellLat, cellLng]);

  // QA219: NO map overlay, card, pill, counter, text or invisible click layer.
  return null;
}

// Shown in Perfil, not above the map. Default is on, with a persistent opt-out.
export function PassengerDemandPrivacySettings({ authUserId }: { authUserId?: string | undefined }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(authUserId ? readSharingPreference(authUserId) : false);
  }, [authUserId]);

  const toggle = () => {
    if (!authUserId) return;
    const next = !enabled;
    try {
      localStorage.setItem(preferenceKey(authUserId), next ? "1" : "0");
    } catch {
      return;
    }
    setEnabled(next);
    if (!next) {
      // Delete own presence immediately, rather than relying only on expiration.
      void presenceApi().rpc("apois_passenger_presence_stop").catch(() => undefined);
    }
  };

  return (
    <section data-apois-qa219-privacy-control="true"
      aria-label="Privacidade da região"
      className="rounded-2xl border border-[#E2E4E8] bg-white p-4 text-[#111827]">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">Região para motoristas</p>
          <p className="mt-1 text-xs text-[#626B78]">
            Ativado automaticamente enquanto você usa o aplicativo. Motoristas veem
            apenas regiões aproximadas com 5 ou mais passageiros, nunca seu nome
            ou sua localização individual.
          </p>
        </div>
        <button type="button" role="switch" aria-checked={enabled}
          aria-label="Compartilhar região aproximada com motoristas"
          onClick={toggle} disabled={!authUserId}
          className={enabled
            ? "min-h-11 shrink-0 rounded-full bg-[#138A4A] px-3 text-xs font-bold text-white"
            : "min-h-11 shrink-0 rounded-full bg-[#6B7280] px-3 text-xs font-bold text-white"}>
          {enabled ? "Ligado" : "Desligado"}
        </button>
      </div>
    </section>
  );
}
