import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-entregador");
const file=resolve(root,"src/components/CourierPremiumViews.tsx");
const cssFile=resolve(root,"src/system-theme.css");
let s=readFileSync(file,"utf8");
if(s.includes("data-apois-courier-search-scan-v1"))throw Error("[FAIL] Scan already applied");
const start=s.indexOf("export function CourierWaitingSheet(");
const end=s.indexOf("export function CourierOfflineCard(",start);
if(start<0||end<start)throw Error("[FAIL] Courier waiting panel not found");
let panel=s.slice(start,end);
const anchor='      <div className="mt-2 grid grid-cols-3 divide-x divide-[#E5E7EB] rounded-xl bg-[#F7F7F8] p-2">';
if(panel.split(anchor).length!==2)throw Error("[FAIL] Waiting metrics anchor changed");
const scanning=`      <div data-apois-courier-search-scan-v1 role="status" aria-live="polite"
        className="relative mt-4 overflow-hidden rounded-[20px] border border-[#B5E5CF] bg-[#EFFBF4] p-4 text-[#13533B]">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#8FD6B0] bg-white">
            <span className="absolute inset-1 rounded-full border-2 border-[#17A467]/20" />
            <span className="absolute inset-1 animate-spin rounded-full border-2 border-transparent border-t-[#169E60] motion-reduce:animate-none" />
            <Radio className="h-5 w-5 text-[#148D54]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-[#14563D]">Buscando novas entregas</p>
            <p className="mt-0.5 text-xs font-medium text-[#357355]">Varredura ativa enquanto você está disponível</p>
          </div>
        </div>
        <div aria-hidden="true" className="relative mt-3 h-[7px] overflow-hidden rounded-full bg-[#D3EBDE]">
          <div className="apois-courier-scan-indicator absolute inset-y-0 left-0 w-[38%] rounded-full bg-gradient-to-r from-[#80D8A8] via-[#16A167] to-[#07884C] shadow-[0_0_15px_rgba(19,156,87,.45)]" />
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[#357355]">A busca de pedidos depende da conexão e da disponibilidade real do servidor.</p>
      </div>
`;
panel=panel.replace(anchor,scanning+anchor);
s=s.slice(0,start)+panel+s.slice(end);
writeFileSync(file,s,"utf8");
let css=readFileSync(cssFile,"utf8");
const styles=`
/* APOIS_COURIER_SEARCH_SCAN_V1: 99-style moving green search activity, original animation. */
@keyframes apois-courier-search-sweep {
  0% { transform:translateX(-105%); opacity:.6 }
  50% { opacity:1 }
  100% { transform:translateX(280%); opacity:.6 }
}
.apois-system-theme [data-apois-courier-search-scan-v1] .apois-courier-scan-indicator {
 animation:apois-courier-search-sweep 2.3s ease-in-out infinite;
 will-change:transform;
}
@media(prefers-reduced-motion:reduce) {
 .apois-system-theme [data-apois-courier-search-scan-v1] .apois-courier-scan-indicator {animation:none;transform:translateX(80%)}
}
`;
if(css.includes("APOIS_COURIER_SEARCH_SCAN_V1"))throw Error("[FAIL] Scan styles already applied");
writeFileSync(cssFile,css+styles,"utf8");
console.log("[OK] Entregador: green animated search sweep only in online idle waiting sheet; backend untouched.");
