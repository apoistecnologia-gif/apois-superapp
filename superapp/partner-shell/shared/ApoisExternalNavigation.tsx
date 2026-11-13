// APOIS_PARTNER_EXTERNAL_NAV_V1
// Compiled into both pinned disposable Partner workspaces. The native plugin
// starts the actual Google Maps/Waze Activity, not an in-app browser WebView.
import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Navigation2, MapPinned, ChevronDown } from "lucide-react";
import { ApoisSlideAction } from "./ApoisSwipeControls";

export type ApoisNavigator = "google" | "waze";
export type ApoisPartnerRole = "motorista" | "entregador";
type OpenResult = { opened: boolean; fallback: boolean; provider: string };
type ExternalPlugin = {
  open(options: { provider: ApoisNavigator; latitude: number; longitude: number }): Promise<OpenResult>;
  setOperation(options: { role: ApoisPartnerRole; active: boolean; rideId?: string | undefined; pickupLatitude?: number | undefined; pickupLongitude?: number | undefined; stage?:string | undefined }): Promise<{updated:boolean}>;
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

export async function setApoisOperationalNotification(role: ApoisPartnerRole, active: boolean, rideId?:string, pickupLatitude?:number, pickupLongitude?:number, stage?:string): Promise<void> {
  // Background GPS service already exists. Only update its notification when
  // Android app is visible; never start a second service from a background tab.
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
  try { await NativeNavigation.setOperation({ role, active, ...(role==="motorista" && active && rideId && validNavigationCoordinate(pickupLatitude,pickupLongitude) ? {rideId,pickupLatitude,pickupLongitude} : {}), ...(role==="motorista" && stage ? {stage} : {}) }); }
  catch (error) { console.warn("[APOIS] Não foi possível atualizar o texto da notificação operacional.", error); }
}

export function useApoisOperationalNotification(role: ApoisPartnerRole, active: boolean, rideId?:string, pickupLatitude?:number, pickupLongitude?:number, stage?:string): void {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    let closed = false;
    // The service ACK can happen just after the backend active job is recovered.
    void setApoisOperationalNotification(role, active, rideId, pickupLatitude, pickupLongitude, stage);
    const retry = window.setTimeout(() => {
      if (!closed) void setApoisOperationalNotification(role, active, rideId, pickupLatitude, pickupLongitude, stage);
    }, 1500);
    let listener: { remove: () => Promise<void> } | null = null;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive && !closed) void setApoisOperationalNotification(role, active, rideId, pickupLatitude, pickupLongitude, stage);
    }).then((handle) => {
      if (closed) void handle.remove();
      else listener = handle;
    }).catch(() => undefined);
    return () => {
      closed = true;
      window.clearTimeout(retry);
      if (listener) void listener.remove();
    };
  }, [role, active, rideId, pickupLatitude, pickupLongitude, stage]);
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
            className="flex min-h-[56px] shrink-0 items-center justify-center gap-1.5 rounded-[16px] border border-[#D6D9DF] bg-white px-3.5 text-xs font-extrabold text-[#252B36] shadow-[0_4px_12px_rgba(15,23,42,.07)] transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E51B23]"
            aria-label="Escolher aplicativo de navegação">
            <Navigation2 aria-hidden="true" className="h-4 w-4 text-[#D51A29]"/>
            <span>Trocar</span>
            <ChevronDown aria-hidden="true" className="h-4 w-4 text-[#64748B]"/>
          </button>
        ) : null}
      </div>
      {message ? <p role="status" className="mt-1 text-xs font-semibold text-[#AF1830]">{message}</p> : null}
      {chooser ? (
        <div role="group" aria-label={"Escolher navegador para " + stage}
          className="mt-3 rounded-[22px] border border-[#E1E3E8] bg-white p-4 text-[#171B23] shadow-[0_16px_34px_rgba(15,23,42,.12)]">
          <p className="mb-3 text-[13px] font-black tracking-[-.01em]">Navegar {stage} com:</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => void openProvider("google")}
              className="min-h-[52px] rounded-[15px] border border-[#E51B23] bg-[#E51B23] px-2 text-[13px] font-extrabold text-white shadow-[0_6px_18px_rgba(229,27,35,.2)] transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E51B23]">Google Maps</button>
            <button type="button" disabled={busy} onClick={() => void openProvider("waze")}
              className="min-h-[52px] rounded-[15px] border border-[#D5D9E0] bg-[#F8F9FB] px-2 text-[13px] font-extrabold text-[#252B36] shadow-sm transition active:scale-[.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D51A29]">Waze</button>
          </div>
          <label className="mt-3 flex min-h-[46px] items-center gap-2.5 rounded-[13px] border border-[#E5E7EB] bg-[#F8F9FB] px-3 text-[12px] font-semibold text-[#344054]">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}
              className="h-4 w-4 accent-[#E51B23]" /> Salvar como navegador preferido
          </label>
          <button type="button" onClick={() => setChooser(false)}
            className="mt-1 min-h-[42px] w-full rounded-xl text-[12px] font-bold text-[#6B7280] transition hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D51A29]">Fechar opções</button>
        </div>
      ) : null}
    </div>
  );
}

/** QA240: polished shortcut inside APOIS to the external Maps/Waze navigator. */
export function ApoisQuickMapButton({latitude,longitude}:{latitude:number|null|undefined;longitude:number|null|undefined}){
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  if(!validNavigationCoordinate(latitude,longitude))return null;
  return <div data-apois-qa240-map-shortcut="true"
    className="pointer-events-none fixed right-3 z-40 flex flex-col items-end gap-1.5"
    style={{top:"calc(env(safe-area-inset-top) + 128px)"}}>
    <button type="button" disabled={busy} aria-label="Voltar ao Google Maps ou Waze"
      className="pointer-events-auto flex min-h-[50px] items-center gap-2.5 rounded-full border-2 border-white bg-[#E51B23] pl-3.5 pr-4 text-[12px] font-black text-white shadow-[0_12px_28px_rgba(111,13,22,.34)] transition active:scale-[.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF8088]/45 disabled:opacity-70"
      onClick={()=>{if(busy)return;setBusy(true);setError("");
        void launchApoisNavigationAfterRideStart(latitude,longitude)
          .catch(()=>setError("Não foi possível abrir o navegador externo."))
          .finally(()=>setBusy(false));
      }}>
      <MapPinned aria-hidden="true" className="h-[21px] w-[21px]"/>
      <span>{busy?"Abrindo…":"Voltar ao mapa"}</span>
    </button>
    {error?<span role="alert" className="max-w-[210px] rounded-xl border border-[#F7CDD2] bg-white px-3 py-2 text-[11px] font-bold text-[#A71A27] shadow-md">{error}</span>:null}
  </div>;
}
