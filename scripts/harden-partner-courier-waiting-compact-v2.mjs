import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";

const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const homePath=resolve(root,"src/routes/courier.tsx");
let home=readFileSync(homePath,"utf8");
const placeholder='<p className="px-3 py-2 text-center text-xs font-medium text-slate-600">Aguardando novas solicitações de entrega</p>';
if(!home.includes(placeholder))throw Error("[FAIL] Courier waiting placeholder changed");
const original=`<CourierWaitingSheet
                metrics={metrics}
                wallet={wallet}
                onRefresh={() => courier?.id && void loadCourierOperations(courier.id)}
              />`;
home=home.replace(placeholder,original);
writeFileSync(homePath,home,"utf8");

const panelPath=resolve(root,"src/components/CourierPremiumViews.tsx");
let panels=readFileSync(panelPath,"utf8");
const start=panels.indexOf("export function CourierWaitingSheet(");
const end=panels.indexOf("export function CourierOfflineCard(",start);
if(start<0||end<=start)throw Error("[FAIL] CourierWaitingSheet boundaries changed");
const compact=`export function CourierWaitingSheet({ metrics, onRefresh }: any) {
  return (
    <section aria-label="Aguardando novas entregas" className="rounded-[22px] border border-[#E5E7EB] bg-white p-3 text-[#111827] shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
          <LocateFixed className="h-4 w-4 text-[#E51B23]" /> Aguardando chamadas
        </p>
        <button type="button" onClick={onRefresh} aria-label="Atualizar ofertas"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E5E7EB] bg-white text-[#D71920] active:scale-95">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 divide-x divide-[#E5E7EB] rounded-xl bg-[#F7F7F8] p-2">
        <div className="min-w-0 px-1 text-center">
          <p className="text-[10px] font-semibold text-[#626B78]">Ganhos hoje</p>
          <p className="mt-1 text-sm font-bold text-[#D71920]">{courierMoney(metrics?.earnings_today)}</p>
        </div>
        <div className="min-w-0 px-1 text-center">
          <p className="text-[10px] font-semibold text-[#626B78]">Entregas hoje</p>
          <p className="mt-1 text-sm font-bold text-[#111827]">{String(metrics?.completed_deliveries ?? 0)}</p>
        </div>
        <div className="min-w-0 px-1 text-center">
          <p className="text-[10px] font-semibold text-[#626B78]">Tempo online</p>
          <p className="mt-1 text-sm font-bold text-[#111827]">{formatCourierOnlineTime(metrics?.online_seconds_today)}</p>
        </div>
      </div>
    </section>
  );
}

`;
panels=panels.slice(0,start)+compact+panels.slice(end);
writeFileSync(panelPath,panels,"utf8");
console.log("[OK] Entregador: espera compacta com ganhos, entregas, tempo online e atualização preservados.");
