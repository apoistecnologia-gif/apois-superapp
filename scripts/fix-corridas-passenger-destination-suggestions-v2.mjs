// APOIS_CLIENTE_DESTINATION_FEEDBACK_V2
// Fix invisible autocomplete states without changing the established Places RPC,
// the selected destination, the map, favorites or trip request protocol.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas", "src/routes/_authenticated.buscar-destino.tsx");
let source = readFileSync(file,"utf8");

function replaceOnce(before,after,label) {
  const matches=source.split(before).length-1;
  if(matches!==1) throw Error("[FAIL] Corridas autocomplete "+label+" anchor matches: "+matches);
  source=source.replace(before,after);
}
if(source.includes("APOIS_CLIENTE_DESTINATION_FEEDBACK_V2"))throw Error("[FAIL] Autocomplete feedback applied twice");
replaceOnce(
  'const { query, suggestions, status, isLoading, error, setQuery, clearQuery, reset } =\n    useDestinationSearch();',
  'const { query, suggestions, status, isLoading, error, setQuery, clearQuery, reset, retry } =\n    useDestinationSearch();',
  "reuse existing retry handler"
);
replaceOnce('                  {status === "loading" && (',
  '                  {/* APOIS_CLIENTE_DESTINATION_FEEDBACK_V2: never render a blank results panel during debounce or provider failures. */}\n                  {(status === "loading" || status === "debouncing") && (',
  "show in-progress debounce state"
);
replaceOnce('Buscando endereços...</p>','Buscando sugestões de endereço...</p>',"search feedback copy");

// Android WebView IME/composition fallback. Do not blur here: blurring before tapping
// a prediction could discard the user's selection. Existing onChange stays intact.
replaceOnce(
  'onChange={(e) => setQuery(e.target.value)}',
  'onChange={(e) => setQuery(e.target.value)}\n                  onInput={(e) => { if (e.currentTarget.value !== query) setQuery(e.currentTarget.value); }}\n                  onCompositionEnd={(e) => { if (e.currentTarget.value !== query) setQuery(e.currentTarget.value); }}',
  "native keyboard input/composition sync"
);


const oldEmpty = [
'                  {status === "empty" && (',
'                    <div className="flex flex-col items-center py-10 gap-2">',
'                      <AlertCircle className="w-8 h-8 text-gray-600" />',
'                      <p className="text-sm text-gray-500">Nenhum endereço encontrado.</p>',
'                    </div>',
'                  )}',
].join("\n");
const newEmpty = [
'                  {status === "empty" && (',
'                    <div data-apois-places-empty-v2 role="status" className="flex flex-col items-center gap-3 rounded-[20px] border border-[#E2E4E8] bg-[#F7F8FA] px-4 py-6 text-center">',
'                      <AlertCircle className="h-6 w-6 text-[#586272]" aria-hidden="true" />',
'                      <p className="text-sm font-semibold text-[#374151]">Nenhum endereço encontrado. Experimente o nome de uma rua ou do estabelecimento.</p>',
'                      <div className="flex flex-wrap justify-center gap-2">',
'                        <button type="button" onClick={retry} className="min-h-11 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-bold text-[#111827]">Pesquisar novamente</button>',
'                        <button type="button" onClick={() => { setIsBottomSheetOpen(false); setIsPickingOnMap(true); }} className="min-h-11 rounded-xl bg-[#E51B23] px-4 py-2 text-sm font-bold text-white">Escolher no mapa</button>',
'                      </div>',
'                    </div>',
'                  )}',
].join("\n");
replaceOnce(oldEmpty,newEmpty,"empty autocomplete fallback");

const oldFailed = [
'                  {status === "failed" && (',
'                    <div className="flex flex-col items-center py-10 gap-4">',
'                      <p className="text-sm text-red-400">Não foi possível pesquisar agora.</p>',
'                      <Button',
'                        onClick={() => setQuery(query)}',
'                        variant="outline"',
'                        className="border-red-500/50 text-red-400"',
'                      >',
'                        Tentar novamente',
'                      </Button>',
'                    </div>',
'                  )}',
].join("\n");
const newFailed = [
'                  {(["failed", "network_error", "rate_limited", "configuration_missing"] as const).some((value) => value === status) && (',
'                    <div data-apois-places-error-v2 role="alert" className="flex flex-col items-center gap-3 rounded-[20px] border border-[#FECACA] bg-[#FFF7F7] px-4 py-6 text-center">',
'                      <AlertCircle className="h-6 w-6 text-[#B91C1C]" aria-hidden="true" />',
'                      <p className="text-sm font-semibold leading-5 text-[#991B1B]">{error?.message || "O serviço de endereços está indisponível. Tente novamente."}</p>',
'                      <p className="text-xs font-medium leading-5 text-[#586272]">Sua localização e as corridas não foram alteradas.</p>',
'                      <div className="flex flex-wrap justify-center gap-2">',
'                        <button type="button" onClick={retry} className="min-h-11 rounded-xl border border-[#B91C1C] bg-white px-4 py-2 text-sm font-bold text-[#991B1B]">Tentar novamente</button>',
'                        <button type="button" onClick={() => { setIsBottomSheetOpen(false); setIsPickingOnMap(true); }} className="min-h-11 rounded-xl bg-[#E51B23] px-4 py-2 text-sm font-bold text-white">Escolher no mapa</button>',
'                      </div>',
'                    </div>',
'                  )}',
].join("\n");
replaceOnce(oldFailed,newFailed,"all provider failure states");

const missing=[];
for(const marker of [
  "APOIS_CLIENTE_DESTINATION_FEEDBACK_V2",
  'status === "debouncing"',
  '"network_error", "rate_limited", "configuration_missing"',
  'error?.message',
  'onClick={retry}',
  'data-apois-places-empty-v2',
  'data-apois-places-error-v2',
  'onClick={() => handleSelectSuggestion(suggestion)}',
  'handleFinalSelection(details)',
  'data-apois-favorite-save-mode="true"',
])if(!source.includes(marker))missing.push(marker);
if(missing.length)throw Error("[FAIL] Destination feedback contract missing "+missing.join("|"));
writeFileSync(file,source,"utf8");
console.log("[OK] APOIS Cliente: autocomplete shows debounce/network/quota/configuration errors, retry and map fallback; destination selection preserved.");
