// INV-025 — painel financeiro Admin Corridas: atualizar sempre usa clock atual.
// Sem alteração na Fare Engine, no ledger, nas datas customizadas ou no banco.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const workspace=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const path=resolve(workspace,"src/routes/admin.financeiro.tsx");
let src=readFileSync(path,"utf8");
const MARK="APOIS_ADMIN_FINANCE_CLOCK_REFRESH_V2";
if(src.includes(MARK)){console.log("[OK] finance refresh já corrigido");process.exit(0);}
function one(a,b,id){const count=src.split(a).length-1;if(count!==1)throw Error("[FAIL] INV-025 "+id+" "+count);src=src.replace(a,b);}
one('  const [loadError, setLoadError] = useState<string | null>(null);',
`  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastQueriedRange,setLastQueriedRange]=useState<{from:Date;to:Date}|null>(null);
  // ${MARK}: consulta atual reflete limites efetivamente usados.`,"queried range state");
one(`  async function load() {
    if (invalidCustomRange) {`,
`  async function load() {
    // Do not reuse a memoized end = "now" from the first render.
    // Custom dates retain their user-selected civil-day bounds.
    const requestedRange=rangeFor(preset,customFrom,customTo);
    if (preset === "custom" && customFrom && customTo &&
        requestedRange.from.getTime()>requestedRange.to.getTime()) {`,"recompute on refresh");
one('const data = await getAdminFinanceSummary(range.from, range.to);',
'const data = await getAdminFinanceSummary(requestedRange.from, requestedRange.to);',"real queried window");
one('      setSummary(data);',
'      setSummary(data);\n      setLastQueriedRange(requestedRange);',"remember queried window");
one(`      </DSCard>

      {loading ? (`,
`      </DSCard>
      {lastQueriedRange && !loading && !loadError && (
        <p className="mb-4 text-xs text-muted-foreground" role="status">
          Consulta atualizada: {lastQueriedRange.from.toLocaleString("pt-BR")} até {lastQueriedRange.to.toLocaleString("pt-BR")}.
        </p>
      )}

      {loading ? (`,"display effective range");
if(!src.includes(MARK)||!src.includes("getAdminFinanceSummary(requestedRange.from, requestedRange.to)"))throw Error("INV-025 patch incomplete");
writeFileSync(path,src,"utf8");
console.log("[OK] INV-025: Atualizar consulta janela relativa no momento real do clique.");
