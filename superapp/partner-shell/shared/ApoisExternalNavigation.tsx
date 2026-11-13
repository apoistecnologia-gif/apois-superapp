// APOIS_PARTNER_EXTERNAL_NAV_V1
// Compiled into both pinned disposable Partner workspaces. The native plugin
// starts the actual Google Maps/Waze Activity, not an in-app browser WebView.
import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { ApoisSlideAction } from "./ApoisSwipeControls";

export type ApoisNavigator = "google" | "waze";
export type ApoisPartnerRole = "motorista" | "entregador";
type OpenResult = { opened: boolean; fallback: boolean; provider: string };
type ExternalPlugin = {
  open(options: { provider: ApoisNavigator; latitude: number; longitude: number }): Promise<OpenResult>;
  setOperation(options: { role: ApoisPartnerRole; active: boolean; rideId?: string; pickupLatitude?: number; pickupLongitude?: number }): Promise<{updated:boolean}>;
};
const NativeNavigation = registerPlugin<ExternalPlugin>("APOISExternalNavigation");
const PREFERENCE_KEY = "apois-parceiro:external-navigator:v1";

export function validNavigationCoordinate(latitude: unknown, longitude: unknown): boolean {
  const lat = typeof latitude === "number" ? latitude : typeof latitude === "string" && latitude.trim() ? Number(latitude) : NaN;
  const lng = typeof longitude === "number" ? longitude : typeof longitude === "string" && longitude.trim() ? Number(longitude) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
    && !(lat === 0 && lng === 0);
}

export function externalMapUrl(provider: ApoisNavigator, latitude: number, longitude: number): string {
  if (!validNavigationCoordinate(latitude, longitude)) throw Error("Coordenadas de navegação inválidas.");
  const point = encodeURIComponent(latitude.toFixed(6) + "," + longitude.toFixed(6));
  return provider === "google"
    ? "https://www.google.com/maps/dir/?api=1&destination=" + point + "&travelmode=driving&dir_action=navigate"
    : "https://waze.com/ul?ll=" + point + "&navigate=yes&utm_source=apois_parceiro";
}

function readPreferred(): ApoisNavigator | null {
  try {
    const stored = window.localStorage.getItem(PREFERENCE_KEY);
    return stored === "google" || stored === "waze" ? stored : null;
  } catch { return null; }
}
function writePreferred(value: ApoisNavigator | null) {
  try {
    if (value) window.localStorage.setItem(PREFERENCE_KEY, value);
    else window.localStorage.removeItem(PREFERENCE_KEY);
  } catch { /* Navigation can still launch when storage is unavailable. */ }
}

// QA234: call ONLY after the server accepted the PIN and updated the ride.
// Android launches the saved preferred provider (Google Maps by default).
// A navigation failure must never roll back a successfully started ride.
export async function launchApoisNavigationAfterRideStart(latitude: number | null | undefined, longitude: number | null | undefined): Promise<void> {
  if (!validNavigationCoordinate(latitude, longitude)) throw Error("Destino da corrida sem coordenadas válidas.");
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  const provider = readPreferred() ?? "google";
  const result = await NativeNavigation.open({provider, latitude: Number(latitude), longitude: Number(longitude)});
  if (!result.opened) throw Error("Navegador externo não abriu. Use Iniciar navegação no APOIS.");
}

export async function setApoisOperationalNotification(role: ApoisPartnerRole, active: boolean, rideId?:string, pickupLatitude?:number, pickupLongitude?:number): Promise<void> {
  // Background GPS service already exists. Only update its notification when
  // Android app is visible; never start a second service from a background tab.
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  try { await NativeNavigation.setOperation({ role, active, ...(role==="motorista" && active && rideId && validNavigationCoordinate(pickupLatitude,pickupLongitude) ? {rideId,pickupLatitude,pickupLongitude} : {}) }); }
  catch (error) { console.warn("[APOIS] Não foi possível atualizar o texto da notificação operacional.", error); }
}

export function useApoisOperationalNotification(role: ApoisPartnerRole, active: boolean, rideId?:string, pickupLatitude?:number, pickupLongitude?:number): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    let closed = false;
    // The service ACK can happen just after the backend active job is recovered.
    void setApoisOperationalNotification(role, active, rideId, pickupLatitude, pickupLongitude);
    const retry = window.setTimeout(() => {
      if (!closed) void setApoisOperationalNotification(role, active, rideId, pickupLatitude, pickupLongitude);
    }, 1500);
    let listener: { remove: () => Promise<void> } | null = null;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && !closed) void setApoisOperationalNotification(role, active, rideId, pickupLatitude, pickupLongitude);
    }).then((handle) => {
      if (closed) void handle.remove();
      else listener = handle;
    }).catch(() => undefined);
    return () => {
      closed = true;
      window.clearTimeout(retry);
      if (listener) void listener.remove();
    };
  }, [role, active, rideId, pickupLatitude, pickupLongitude]);
}

export function ApoisExternalNavigation({
  latitude, longitude, stage,
}: { latitude: number | string | null | undefined; longitude: number | string | null | undefined; stage: string }) {
  const [preferred, setPreferred] = useState<ApoisNavigator | null>(readPreferred);
  const [chooser, setChooser] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const coordinateValid = validNavigationCoordinate(latitude, longitude);

  async function openProvider(provider: ApoisNavigator) {
    if (!coordinateValid) {
      setMessage("Coordenadas deste destino indisponíveis. Confira a etapa antes de seguir.");
      return;
    }
    if (busy) return;
    setBusy(true);
    setMessage("");
    setChooser(false);
    const lat = Number(latitude), lng = Number(longitude);
    let installedProviderOpened = true;
    try {
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
        const result = await NativeNavigation.open({ provider, latitude: lat, longitude: lng });
        if (!result.opened) throw Error("O Android não confirmou a abertura do navegador.");
        if (result.fallback) {
          installedProviderOpened = false;
          setMessage((provider === "waze" ? "Waze" : "Google Maps") + " não está instalado. Foi aberto o link oficial no navegador.");
        }
      } else {
        const url = externalMapUrl(provider, lat, lng);
        const popup = window.open(url, "_blank", "noopener,noreferrer");
        if (!popup) throw Error("O navegador bloqueou a nova janela. Autorize pop-ups para abrir o mapa.");
      }
      if (remember && installedProviderOpened) { writePreferred(provider); setPreferred(provider); }
    } catch (error) {
      const description = error instanceof Error ? error.message : "Não foi possível abrir a navegação.";
      setMessage(description + " Tente o outro aplicativo.");
      setChooser(true);
    } finally {
      setBusy(false);
    }
  }

  function launch() {
    if (!coordinateValid) { setMessage("Coordenadas do destino não disponíveis."); return; }
    if (preferred) { void openProvider(preferred); return; }
    setChooser(true);
    setMessage("");
  }

  return (
    <div data-apois-external-navigation="true" className="w-full min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <ApoisSlideAction
          label="Iniciar navegação"
          disabled={busy || !coordinateValid}
          busy={busy}
          onConfirm={launch}
          className="flex-1"
        />
        {preferred ? (
          <button type="button" onClick={() => { setChooser(true); setMessage(""); }}
            className="min-h-11 shrink-0 rounded-xl border border-[#D0D5DD] bg-white px-3 text-xs font-bold text-[#344054]"
            aria-label="Trocar aplicativo de navegação">Trocar</button>
        ) : null}
      </div>
      {message ? <p role="status" className="mt-1 text-xs font-semibold text-[#AF1830]">{message}</p> : null}
      {chooser ? (
        <div role="group" aria-label={"Escolher navegador para " + stage}
          className="mt-2 rounded-2xl border border-[#E5E7EB] bg-white p-3 text-[#111827] shadow-md">
          <p className="mb-2 text-xs font-extrabold">Navegar {stage} com:</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void openProvider("google")}
              className="min-h-11 rounded-xl border border-[#E51B23] bg-[#FFF1F2] px-2 text-xs font-bold text-[#C9141B]">Google Maps</button>
            <button type="button" disabled={busy} onClick={() => void openProvider("waze")}
              className="min-h-11 rounded-xl border border-[#D0D5DD] bg-[#F9FAFB] px-2 text-xs font-bold text-[#344054]">Waze</button>
          </div>
          <label className="mt-3 flex min-h-9 items-center gap-2 text-xs font-medium text-[#344054]">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 accent-[#E51B23]" /> Salvar como navegador preferido
          </label>
          <button type="button" onClick={() => setChooser(false)}
            className="min-h-9 text-xs font-semibold text-[#667085]">Fechar opções</button>
        </div>
      ) : null}
    </div>
  );
}
