import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// APOIS_PASSENGER_QA218_OPTIN_V1. Never infer consent from login, GPS
// permission, account installation, or previous ride requests.
type Props = {
  authUserId?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  showControl?: boolean | undefined;
};
type PresenceState = "off" | "waiting" | "sharing" | "error";

const isValidCoordinate = (lat: number | undefined, lng: number | undefined) =>
  typeof lat === "number" && typeof lng === "number" &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -35 && lat <= 6 && lng >= -74 && lng <= -32;

type PresenceRpc = {
  rpc: (
    name: "apois_passenger_presence_ping" | "apois_passenger_presence_stop",
    args?: { _lat: number; _lng: number },
  ) => Promise<{ data: boolean | null; error: { message: string } | null }>;
};

function presenceApi(): PresenceRpc {
  // QA218 new RPC contracts precede generated Supabase TypeScript bindings.
  return supabase as unknown as PresenceRpc;
}

export function PassengerDemandSharing({
  authUserId, latitude, longitude, showControl = true,
}: Props) {
  const [enabled, setEnabled] = useState(false);
  const [state, setState] = useState<PresenceState>("off");

  const cellLat = typeof latitude === "number" && Number.isFinite(latitude)
    ? Number(latitude.toFixed(2)) : undefined;
  const cellLng = typeof longitude === "number" && Number.isFinite(longitude)
    ? Number(longitude.toFixed(2)) : undefined;
  const storageKey = authUserId ? "apois:passenger:demand-consent:" + authUserId : null;

  useEffect(() => {
    try {
      setEnabled(Boolean(storageKey && localStorage.getItem(storageKey) === "1"));
    } catch {
      setEnabled(false);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || !authUserId) {
      setState("off");
      return;
    }
    let disposed = false;
    let pending: Promise<void> = Promise.resolve();

    const stop = () => {
      pending = pending.then(async () => {
        try { await presenceApi().rpc("apois_passenger_presence_stop"); }
        catch { /* stale rows cease being visible within two minutes */ }
      });
    };

    const send = () => {
      if (!isValidCoordinate(cellLat, cellLng) ||
          !navigator.onLine || document.visibilityState !== "visible") {
        if (!disposed) setState("waiting");
        return;
      }
      pending = pending.then(async () => {
        if (disposed || !navigator.onLine || document.visibilityState !== "visible") return;
        try {
          const {data, error} = await presenceApi().rpc("apois_passenger_presence_ping", {
            _lat: cellLat!, _lng: cellLng!,
          });
          if (!disposed) setState(!error && data === true ? "sharing" : "error");
        } catch {
          if (!disposed) setState("error");
        }
      });
    };

    send();
    const timer = window.setInterval(send, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        setState("waiting");
        stop();
      } else send();
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

  const toggle = () => {
    if (!storageKey) return;
    const next = !enabled;
    try {
      if (next) localStorage.setItem(storageKey, "1");
      else localStorage.removeItem(storageKey);
    } catch {
      // Session consent still works without persistent local storage.
    }
    setEnabled(next);
    setState(next ? "waiting" : "off");
  };

  return (
    <aside
      data-apois-passenger-demand-optin-qa218="true"
      className={showControl
        ? "pointer-events-auto absolute left-3 top-[calc(env(safe-area-inset-top,0px)+110px)] z-30 max-w-[238px] rounded-2xl border border-[#E2E4E8] bg-white/95 p-3 shadow-xl"
        : "hidden"}
      aria-label="Compartilhamento opcional da região"
    >
      <button type="button" role="switch" aria-checked={enabled}
        onClick={toggle} disabled={!authUserId}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-xs font-bold text-[#111827] disabled:opacity-50">
        <span>Compartilhar minha região</span>
        <span aria-hidden="true"
          className={enabled ? "rounded-full bg-[#138A4A] px-2 py-1 text-white" : "rounded-full bg-[#6B7280] px-2 py-1 text-white"}>
          {enabled ? "Ligado" : "Desligado"}
        </span>
      </button>
      <p className="mt-1 text-[10px] leading-4 text-[#606977]">
        Opcional. Apenas regiões aproximadas com 5 ou mais passageiros aparecem para os motoristas.
      </p>
      {enabled ? (
        <p role="status" className="mt-1 text-[10px] font-semibold text-[#374151]">
          {state === "sharing" ? "Região compartilhada enquanto o app estiver em uso."
           : state === "waiting" ? "Aguardando GPS ou conexão..."
           : state === "error" ? "Não foi possível atualizar sua região." : ""}
        </p>
      ) : null}
    </aside>
  );
}
