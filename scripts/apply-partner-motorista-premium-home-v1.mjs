/**
 * APOIS_DRIVER_PREMIUM_HOME_V1
 * Presentation-only. Executed AFTER all Motorista QA hardeners, against the
 * disposable .work/partner-motorista copy. Protected submodules are untouched.
 * Keeps real map/GPS/ride controllers, session, toggling, offers and PIN intact.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista');
const file = resolve(workspace, 'src/routes/motorista.app.tsx');
const marker = 'APOIS_DRIVER_PREMIUM_HOME_V1';
let source = readFileSync(file, 'utf8');
if (source.includes(`{/* ${marker}`)) throw Error('[FAIL] Premium Home already applied');

function replaceBetween(startText, endText, replacement, label) {
  const start = source.indexOf(startText);
  const end = start < 0 ? -1 : source.indexOf(endText, start + startText.length);
  if (start < 0 || end <= start || source.indexOf(startText, start + startText.length) >= 0) {
    throw Error('[FAIL] Premium Home changed or ambiguous anchors: ' + label);
  }
  const previous = source.slice(start, end);
  source = source.slice(0, start) + replacement + source.slice(end);
  return previous;
}
function replaceOnce(oldText, newText, label) {
  if (source.split(oldText).length !== 2) throw Error('[FAIL] Premium Home anchor: ' + label);
  source = source.replace(oldText, newText);
}

// Import the already generated, official PNG; do not create or recolor a logo.
replaceOnce(
  'import { DriverActiveRideRecovery } from "@/components/DriverActiveRideRecovery";',
  'import { DriverActiveRideRecovery } from "@/components/DriverActiveRideRecovery";\n' +
  'import { APOIS_LOGO_DATA_URL } from "@/assets/apoisLogoData";\n' +
  'import { Bell, CarFront, House, UserRound, WalletCards } from "lucide-react";',
  'official brand and icons'
);

// Home header is hidden during an offer, rating or active ride; these have
// their own immutable operational layouts and navigation protections.
const oldHeader = replaceBetween('      {/* Top bar', '      <DriverSideMenu', `      {/* ${marker}: approved light map-first home, native state only. */}
      {!active && !incoming && !ratingRide && (
        <div data-apois-premium-driver-header className="pointer-events-none absolute inset-x-0 top-0 z-40 px-3 pt-[calc(env(safe-area-inset-top)+8px)]">
          <div className="pointer-events-auto mx-auto max-w-md rounded-b-[24px] border border-t-0 border-[#E8EAEE] bg-white/95 px-3 pb-3 pt-2 text-[#0D0F12] shadow-[0_14px_38px_-25px_rgba(13,15,18,.34)] backdrop-blur-lg">
            <header className="flex min-h-[52px] items-center justify-between gap-3">
              <button type="button" onClick={() => setSideMenuOpen(true)} aria-label="Abrir menu lateral"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#0D0F12] transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB071D]">
                <Menu className="h-6 w-6" aria-hidden="true" />
              </button>
              <img src={APOIS_LOGO_DATA_URL} alt="APOIS" className="h-12 w-12 shrink-0 rounded-full object-contain" />
              <button type="button" onClick={() => void navigate({ to: "/motorista/notificacoes" })}
                aria-label="Abrir notificações" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-[#0D0F12] transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB071D]">
                <Bell className="h-[21px] w-[21px]" aria-hidden="true" />
              </button>
            </header>
            <h1 className="mt-0.5 text-center text-[19px] font-black leading-6 tracking-tight">
              <span>APOIS</span> <span className="text-[#F51D2A]">MOTORISTA</span>
            </h1>
            <div className="mt-2 flex min-h-[50px] items-center justify-between gap-3 rounded-[18px] border border-[#CBEBD5] bg-[#E6FAED] px-4">
              <div className="flex min-w-0 items-center gap-2.5" role="status" aria-live="polite">
                <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + (online ? "bg-[#08A63B]" : "bg-[#838B98]")} aria-hidden="true" />
                <span className="truncate text-[15px] font-extrabold text-[#0D0F12]">{online ? "Online" : "Offline"}</span>
                {gpsStatus === "loading" && <span className="text-[10px] text-[#40566A]">Conectando GPS…</span>}
              </div>
              <button type="button" role="switch" aria-checked={online}
                aria-label={online ? "Ficar offline" : "Ficar online"}
                disabled={!!effectiveStatusBlock || gpsStatus === "loading"}
                onClick={toggleOnline}
                className={"relative h-8 w-[56px] shrink-0 rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB071D] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 " + (online ? "bg-[#08A63B]" : "bg-[#9AA1AC]")}>
                <span className={"block h-6 w-6 rounded-full bg-white shadow-sm transition-transform " + (online ? "translate-x-6" : "translate-x-0")} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

`, 'home header');
if (!oldHeader.includes('setSideMenuOpen(true)') || !oldHeader.includes('driverName')) {
  throw Error('[FAIL] Premium Home: old menu/greeting header contract changed');
}

// Real daily rides and earnings only. The approved mockup has hours online;
// the current app does NOT supply that value, therefore show a truthful dash.
const oldIdle = replaceBetween('function IdleBottomPanel(', 'function IncomingOffer(', `function IdleBottomPanel({
  online, stats, gpsMessage, loading, canUseTestLocation, onUseTestLocation,
}: {
  driverName: string; online: boolean; disabled: boolean; toggleOnline: () => void;
  stats: { rides: number; earnings: number }; gpsMessage: string | null;
  loading: boolean; canUseTestLocation: boolean; onUseTestLocation: () => void;
}) {
  return (
    <section data-apois-premium-driver-summary aria-label="Resumo do dia"
      className="absolute inset-x-3 z-30 mx-auto max-h-[min(38dvh,230px)] max-w-md overflow-y-auto overscroll-contain rounded-[24px] border border-[#E8EAEE] bg-white px-3.5 pb-3 pt-2.5 text-[#0D0F12] shadow-[0_-12px_38px_-20px_rgba(13,15,18,.25)]"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}>
      <div className="mx-auto h-1 w-9 rounded-full bg-[#D1D5DB]" aria-hidden="true" />
      <div className="mb-2 mt-1 flex items-center justify-between gap-2 px-1">
        <h2 className="text-[14px] font-extrabold">Hoje</h2>
        <span className="truncate text-[11px] font-semibold text-[#686F79]">
          {loading ? "Obtendo localização…" : online ? "Recebendo corridas" : "Fora de serviço"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1 divide-x divide-[#E5E7EB]">
        <PremiumStat label="Corridas" ariaLabel="Corridas hoje" value={String(stats.rides)} icon={<CarFront className="h-[19px] w-[19px] text-[#F51D2A]" />} />
        <PremiumStat label="Ganhos" ariaLabel="Ganhos hoje" value={formatBRL(stats.earnings || 0)} icon={<WalletCards className="h-[19px] w-[19px] text-[#08A63B]" />} />
        <PremiumStat label="Tempo online" ariaLabel="Tempo online indisponível" value="—" icon={<Clock className="h-[19px] w-[19px] text-[#F51D2A]" />} />
      </div>
      {gpsMessage && <p role="alert" className="mt-2 rounded-xl border border-[#F3C4C8] bg-[#FFF1F2] px-3 py-2 text-[12px] font-semibold text-[#891822]">{gpsMessage}</p>}
      {canUseTestLocation && (
        <button type="button" onClick={onUseTestLocation} className="mt-2 min-h-11 w-full rounded-xl border border-dashed border-[#BB071D] bg-[#FFF1F2] px-3 text-[12px] font-bold text-[#BB071D]">
          Usar localização de teste no Brasil
        </button>
      )}
    </section>
  );
}
function PremiumStat({label, ariaLabel, value, icon}: {label: string; ariaLabel: string; value: string; icon: ReactNode}) {
  return (
    <div aria-label={ariaLabel} className="flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-1.5 text-center">
      <span aria-hidden="true">{icon}</span>
      <strong className="max-w-full truncate text-[clamp(13px,3.5vw,18px)] font-black leading-5 tabular-nums">{value}</strong>
      <span className="text-[10px] font-semibold leading-3 text-[#525966]">{label}</span>
    </div>
  );
}

/* ============================================================
   OFERTA ENTRANTE — unchanged operational component below
   ============================================================ */
`, 'daily panel');
if (!oldIdle.includes('onClick={toggleOnline}') || !oldIdle.includes('onUseTestLocation') ||
    !oldIdle.includes('Corridas hoje') || !oldIdle.includes('Ganhos hoje')) {
  throw Error('[FAIL] Premium Home: old idle control/stats contract changed');
}

// Keep existing ride recovery mounted; four real routes, no fake actions.
replaceOnce('      <DriverActiveRideRecovery />', `      <DriverActiveRideRecovery />
      {!active && !incoming && !ratingRide && gpsStatus !== "loading" && (
        <nav data-apois-premium-driver-nav aria-label="Navegação principal do motorista"
          className="fixed inset-x-0 bottom-0 z-[35] border-t border-[#E7E9ED] bg-white/95 px-[max(env(safe-area-inset-left),8px)] pb-[max(env(safe-area-inset-bottom),6px)] pt-1 shadow-[0_-6px_24px_-14px_rgba(13,15,18,.28)] backdrop-blur-xl">
          <div className="mx-auto grid min-h-[64px] max-w-md grid-cols-4">
            <button type="button" aria-current="page" className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[#F51D2A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB071D]">
              <House className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-extrabold">Início</span><span aria-hidden="true" className="h-[3px] w-7 rounded-full bg-[#F51D2A]" />
            </button>
            <button type="button" onClick={() => void navigate({ to: "/motorista/corridas" })} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[#0D0F12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB071D]">
              <CarFront className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-semibold">Corridas</span>
            </button>
            <button type="button" onClick={() => void navigate({ to: "/motorista/ganhos" })} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[#0D0F12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB071D]">
              <WalletCards className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-semibold">Ganhos</span>
            </button>
            <button type="button" onClick={() => void navigate({ to: "/motorista/perfil" })} className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[#0D0F12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BB071D]">
              <UserRound className="h-5 w-5" aria-hidden="true" /><span className="text-[11px] font-semibold">Perfil</span>
            </button>
          </div>
        </nav>
      )}`, 'bottom recovery and real navigation');

replaceOnce('"calc(env(safe-area-inset-bottom) + 260px)"',
  '"calc(env(safe-area-inset-bottom) + 205px)"', 'idle recenter above summary');

// Require original state/actions and critical ride controls before touching disk.
const must = [
  'onClick={toggleOnline}', 'setSideMenuOpen(true)', 'DriverActiveRideRecovery',
  '<IncomingOffer', '<PickupNavOverlay', '<ActiveTripNavOverlay', '<ActiveRidePanel',
  'onStart={async (code)', 'onComplete={async () =>', 'DriverSideMenu',
  'onUseTestLocation', 'stats.rides', 'stats.earnings', 'data-apois-premium-driver-nav',
  'APOIS_LOGO_DATA_URL', '#F51D2A', '#BB071D',
];
for (const text of must) if (!source.includes(text)) throw Error('[FAIL] Premium Home lost contract: ' + text);
writeFileSync(file, source, 'utf8');
console.log('[OK] APOIS Motorista Premium Home v1: official logo, live online switch, map-first layout, actual daily stats, 4 working tabs.');