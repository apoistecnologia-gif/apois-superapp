import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// APOIS: redesign isolado da tela de busca do passageiro.
// Executar apenas na copia .work, nunca nas fontes fixadas por submodulo.
const path = resolve(".work/corridas/src/components/rides/active/SearchingDriverScreen.tsx");
const before = readFileSync(path, "utf8");
const marker = "APOIS_SEARCHING_DRIVER_PREMIUM_V1";
if (before.includes(marker)) {
  console.log("[OK] APOIS: tela premium de busca ja aplicada.");
  process.exit(0);
}
for (const key of ["export function SearchingDriverScreen", "ActiveRideMap", "onCancel", "onRefresh", "ride.origin_name", "ride.destination_name"]) {
  if (!before.includes(key)) throw new Error("[FAIL] Tela de busca alterada na fonte; revisao necessaria: " + key);
}
const after = `// ${marker}
import { useEffect, useState } from "react";
import { ArrowLeft, Banknote, Clock3, CreditCard, HelpCircle, MapPin, RefreshCw, Search, WifiOff } from "lucide-react";
import { ActiveRideMap } from "@/components/map/ActiveRideMap";
import { formatCurrency } from "@/lib/utils";
import type { ActiveRide } from "@/types/rides/active-ride";

const paymentLabels: Record<string, string> = {
  pix: "Pix", credit: "Cartão de crédito", credit_card: "Cartão de crédito",
  debit: "Cartão de débito", debit_card: "Cartão de débito",
  cash: "Dinheiro", money: "Dinheiro", wallet: "Carteira APOIS", corporate: "Corporativo",
};

type SearchingDriverScreenProps = {
  ride: ActiveRide;
  isRefreshing: boolean;
  isRealtimeConnected: boolean;
  canCancel: boolean;
  onRefresh: () => void;
  onCancel: () => void;
};

function shortAddress(value: string): string {
  return String(value || "Endereço não informado").split(/,\\s*Petrolina|\\s+-\\s+Petrolina|,\\s*PE\\b/i)[0].trim();
}

export function SearchingDriverScreen({
  ride, isRefreshing, isRealtimeConnected, canCancel, onRefresh, onCancel,
}: SearchingDriverScreenProps) {
  // Tempo de permanencia nesta tela, nao uma estimativa ficticia de aceite.
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [ride.id]);
  const timeText = String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
  const paymentLabel = paymentLabels[ride.payment_method] || ride.payment_method;
  const origin = shortAddress(ride.origin_name);
  const destination = shortAddress(ride.destination_name);

  return (
    <main className="relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#F3F4F6] text-[#0D0F12]">
      <div className="app-safe-top app-safe-x relative z-20 flex shrink-0 items-center justify-between bg-[#BB071D] px-4 pb-3 pt-2 text-white">
        <button type="button" aria-label="Voltar ou cancelar busca" onClick={canCancel ? onCancel : onRefresh}
          className="app-pressable flex h-11 w-11 items-center justify-center rounded-full bg-white/15">
          <ArrowLeft size={22} />
        </button>
        <div className="text-center">
          <p className="text-[22px] font-black italic tracking-tight">APOIS</p>
          <p className="text-[9px] font-black uppercase tracking-[0.34em]">Corridas</p>
        </div>
        <button type="button" aria-label="Atualizar informações da corrida" disabled={isRefreshing} onClick={onRefresh}
          className="app-pressable flex h-11 w-11 items-center justify-center rounded-full bg-white/15 disabled:opacity-50">
          <RefreshCw size={19} className={isRefreshing ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="relative min-h-[165px] flex-[1_1_48%] overflow-hidden bg-[#e9e9e7]">
        <ActiveRideMap ride={ride} />
        {/* O mapa usa os marcadores GPS reais; nao desenhar um embarque falso no centro. */}
      </div>

      <div className="app-safe-bottom relative z-10 -mt-5 min-h-0 flex-[1_1_52%] overflow-y-auto rounded-t-[30px] bg-white px-4 pb-5 pt-3 shadow-[0_-10px_30px_rgba(0,0,0,.08)] [scrollbar-width:none]">
        <div className="mx-auto max-w-[480px] space-y-4">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-zinc-200" aria-hidden="true" />
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#F51D2A]/20 bg-red-50 text-[#BB071D]">
              <Search size={23} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[19px] font-black leading-tight">Buscando seu motorista</h1>
              <p className="mt-1 text-[12px] font-medium text-[#686F79]">Procurando motoristas próximos...</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#686F79]">
            <Clock3 size={15} />
            <span>Tempo nesta tela: {timeText}</span>
            {!isRealtimeConnected && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-amber-800">
                <WifiOff size={13} /> Reconectando atualizações
              </span>
            )}
          </div>
          <section aria-label="Dados da corrida" className="rounded-[23px] border border-[#ECEEF0] bg-white p-4 shadow-[0_5px_22px_rgba(0,0,0,.055)]">
            <div className="relative space-y-4 border-l-2 border-dotted border-red-200 pl-5">
              <div className="relative">
                <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white bg-[#F51D2A]" />
                <p className="text-[10px] font-black tracking-wider text-[#686F79]">EMBARQUE</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] font-extrabold leading-snug">{origin}</p>
              </div>
              <div className="relative">
                <MapPin className="absolute -left-[31px] top-0 text-[#F51D2A]" size={21} fill="white" />
                <p className="text-[10px] font-black tracking-wider text-[#686F79]">DESTINO</p>
                <p className="mt-0.5 line-clamp-2 text-[13px] font-extrabold leading-snug">{destination}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#ECEEF0] pt-3">
              <div>
                <p className="text-[10px] font-black tracking-wide text-[#686F79]">VALOR ESTIMADO</p>
                <p className="mt-1 text-[24px] font-black tracking-tight">{formatCurrency(ride.estimated_price)}</p>
              </div>
              <div className="border-l border-[#ECEEF0] pl-3">
                <p className="text-[10px] font-black tracking-wide text-[#686F79]">PAGAMENTO</p>
                <p className="mt-2 flex items-center gap-2 text-[13px] font-extrabold">
                  {ride.payment_method === "cash" || ride.payment_method === "money" ? <Banknote className="shrink-0 text-[#BB071D]" size={20} /> : <CreditCard className="shrink-0 text-[#BB071D]" size={20} />}
                  <span className="truncate">{paymentLabel}</span>
                </p>
              </div>
            </div>
          </section>
          <div className="flex items-center justify-center gap-2 text-[12px] font-semibold text-[#686F79]">
            <HelpCircle size={16} />
            <span>Se precisar de ajuda, utilize o suporte do aplicativo.</span>
          </div>
          {canCancel && (
            <button type="button" onClick={onCancel}
              className="app-pressable min-h-12 w-full rounded-[20px] border border-[#F51D2A] bg-red-50 px-4 py-3 text-[14px] font-black text-[#BB071D]">
              Cancelar busca
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
`;
writeFileSync(path, after, "utf8");
console.log("[OK] APOIS: tela premium de busca aplicada somente em .work/corridas.");
