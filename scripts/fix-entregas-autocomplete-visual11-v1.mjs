// RV11 CV-036 / VIS-037: autocomplete visual feedback; retain V11 latest-only guarantees.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
export const MARK="APOIS_CV11_AUTOCOMPLETE_FEEDBACK_V1";
function replace(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[CV11 autocomplete] "+label+" "+n);return s.replace(a,b)}
export function patchAutocompleteVisual11(s) {
 if(s.includes(MARK)){
  for(const token of ["setAutocompleteStatus(\"error\")","requestId !== searchRequestRef.current","Tentar novamente","Nenhum endereço encontrado"])
   if(!s.includes(token))throw Error("[CV11 autocomplete] partial patch "+token);
  return s;
 }
 for(const token of ["APOIS_ADDRESS_ASYNC_V11","searchRequestRef.current","if (requestId !== searchRequestRef.current) return;"])
  if(!s.includes(token))throw Error("[CV11 autocomplete] missing V11 guard "+token);
 s=replace(s,
  '  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);',
  '  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);\n  const [autocompleteStatus,setAutocompleteStatus] = useState<"idle" | "loading" | "ready" | "empty" | "error">("idle"); // '+MARK,
  "status local");
 s=replace(s,
  '    if (value.trim().length < 3) {\n      setSuggestions([]);\n      return;\n    }\n    try {',
  '    if (value.trim().length < 3) {\n      setSuggestions([]);\n      setAutocompleteStatus("idle");\n      return;\n    }\n    setAutocompleteStatus("loading");\n    try {',
  "search loading");
 s=replace(s,
  '      if (requestId !== searchRequestRef.current) return;\n      setSuggestions(Array.isArray(data?.predictions) ? data.predictions : []);',
  '      if (requestId !== searchRequestRef.current) return;\n      const matches = Array.isArray(data?.predictions) ? data.predictions : [];\n      setSuggestions(matches);\n      setAutocompleteStatus(matches.length === 0 ? "empty" : "ready");',
  "success empty/not empty");
 s=replace(s,
  '      console.error("Erro no autocomplete:", error);\n      setSuggestions([]);',
  '      console.error("Erro no autocomplete:", error);\n      setSuggestions([]);\n      setAutocompleteStatus("error");',
  "visible error");
 s=replace(s,
  '    setQuery(suggestion.description);\n    setSuggestions([]);',
  '    setQuery(suggestion.description);\n    setSuggestions([]);\n    setAutocompleteStatus("idle");',
  "selection invalidates visual status");
 s=replace(s,
  '        {suggestions.length > 0 ? (',
  '        {autocompleteStatus === "loading" ? <p className="mt-2 px-2 text-xs text-zinc-400" aria-live="off">Buscando endereços...</p> : null}\n        {autocompleteStatus === "empty" ? <p className="mt-2 px-2 text-xs text-zinc-400" role="status">Nenhum endereço encontrado para esta busca. Você pode ajustar o texto ou usar sua localização.</p> : null}\n        {autocompleteStatus === "error" ? <div className="mt-2 space-y-2 rounded-xl border border-red-500/30 p-3 text-xs text-red-300" role="alert"><p>Não foi possível consultar os endereços agora.</p><button type="button" onClick={() => void search(query)} className="min-h-11 rounded-lg border border-red-500/40 px-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-2">Tentar novamente</button></div> : null}\n        {suggestions.length > 0 ? (',
  "results vs error and retry");
 return s;
}
export function applyVisual11Autocomplete(root=process.cwd()){
 const path=resolve(root,process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas","src/components/CustomerLocationAddressSelector.tsx");
 const old=readFileSync(path,"utf8"),next=patchAutocompleteVisual11(old);
 if(old!==next)writeFileSync(path,next,"utf8");
 return old!==next;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1]))
 console.log("[OK] RV11 autocomplete feedback",applyVisual11Autocomplete()?"patched":"already applied");
