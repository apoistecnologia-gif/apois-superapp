// APOIS_CLIENTE_ANDROID_DESTINATION_IME_V3
// Android WebView can display Gboard/autofill text without a React onChange tick.
// Reconcile only the active destination field; do not alter Places RPC, ride flow or geolocation.
// Always offer matching persisted recent places when remote autocomplete is unavailable.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const file=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||".work/corridas","src/routes/_authenticated.buscar-destino.tsx");
let src=readFileSync(file,"utf8");
function swap(before,after,reason){const n=src.split(before).length-1;if(n!==1)throw Error("[FAIL] Destination IME "+reason+": "+n);src=src.replace(before,after);}
if(src.includes("APOIS_CLIENTE_ANDROID_DESTINATION_IME_V3"))throw Error("[FAIL] Destination IME applied twice");
swap("  const inputRef = useRef<HTMLInputElement>(null);",
`  const inputRef = useRef<HTMLInputElement>(null);
  // APOIS_CLIENTE_ANDROID_DESTINATION_IME_V3
  const latestQueryRef = useRef(query);
  latestQueryRef.current = query;
  const latestSetQueryRef = useRef(setQuery);
  latestSetQueryRef.current = setQuery;
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    let reconcileTimer: number | null = null;
    let frame: number | null = null;
    const reconcile = () => {
      if (document.activeElement !== input) return;
      const nativeValue = input.value;
      if (nativeValue !== latestQueryRef.current) {
        latestQueryRef.current = nativeValue;
        latestSetQueryRef.current(nativeValue);
      }
    };
    const schedule = () => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => { frame = null; reconcile(); });
    };
    const start = () => {
      schedule();
      if (reconcileTimer === null) reconcileTimer = window.setInterval(reconcile, 450);
    };
    const stop = () => {
      if (reconcileTimer !== null) window.clearInterval(reconcileTimer);
      reconcileTimer = null;
    };
    input.addEventListener("input", schedule);
    input.addEventListener("change", schedule);
    input.addEventListener("compositionend", schedule);
    input.addEventListener("focus", start);
    input.addEventListener("blur", stop);
    if (document.activeElement === input) start();
    return () => {
      stop();
      if (frame !== null) window.cancelAnimationFrame(frame);
      input.removeEventListener("input", schedule);
      input.removeEventListener("change", schedule);
      input.removeEventListener("compositionend", schedule);
      input.removeEventListener("focus", start);
      input.removeEventListener("blur", stop);
    };
  }, []);`,"native keyboard state bridge");
swap("            <AnimatePresence mode=\"wait\">",
`            {/* Local recent places are usable without an online Places response.
                Keep them in the results area after typing, not in the idle favorites view. */}
            {query.trim().length >= 3 && (() => {
              const needle = query.trim().toLocaleLowerCase("pt-BR");
              const matches = [...favorites, ...recent].filter((item, index, list) => {
                if (list.findIndex(other => other.placeId === item.placeId) !== index) return false;
                if (suggestions.some(suggestion => suggestion.placeId === item.placeId)) return false;
                return [item.label, item.nickname, item.formattedAddress]
                  .some(value => String(value ?? "").toLocaleLowerCase("pt-BR").includes(needle));
              }).slice(0, 4);
              if (matches.length === 0) return null;
              return <section data-apois-destination-local-match-v3 role="region" aria-label="Endereços já utilizados" className="mb-3 rounded-xl border border-[#E2E4E8] bg-white p-2">
                <p className="px-2 py-1 text-xs font-semibold text-[#586272]">Endereços já utilizados</p>
                {matches.map(item => <button key={item.placeId} type="button"
                  onClick={() => handleSelectHistoryItem(item as DestinationAddress)}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm font-semibold text-[#111827]">
                  <MapPin className="h-4 w-4 shrink-0 text-[#E51B23]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-words">{item.label}</span>
                </button>)}
              </section>;
            })()}
            <AnimatePresence mode="wait">`,"recent place fallback in search panel");
if(!src.includes('query.trim().length < 3 ? ('))throw Error("[FAIL] Idle/history branch threshold changed");
for(const marker of [
"APOIS_CLIENTE_ANDROID_DESTINATION_IME_V3",
"latestSetQueryRef.current(nativeValue)",
"window.setInterval(reconcile, 450)",
'data-apois-destination-local-match-v3',
"handleSelectHistoryItem(item as DestinationAddress)",
"onClick={() => handleSelectSuggestion(suggestion)}",
])if(!src.includes(marker))throw Error("[FAIL] Destination preserved contract "+marker);
writeFileSync(file,src,"utf8");
console.log("[OK] Cliente: native Android keyboard value reconciles with Places query; saved places remain selectable while remote results load/fail.");
