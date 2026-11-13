// APOIS_CLIENT_QA237_REQUEST_RECOVERY_V1
// Generated Corridas passenger workspace only; original protected source intact.
// Never bypass server fare, wallet, route freshness, auth or dispatch validation.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/corridas/src/routes/_authenticated.inicio.tsx");
let s=readFileSync(path,"utf8");
const marker="APOIS_CLIENT_QA237_REQUEST_RECOVERY_V1";
function once(a,b,label){
 const n=s.split(a).length-1;
 if(n!==1)throw Error("[FAIL] QA237 "+label+" anchors="+n);
 s=s.replace(a,b);
}
if(s.includes(marker))throw Error("[FAIL] QA237 duplicate");
for(const required of ["APOIS_REPORT09_HOME_GUARD_V1","APOIS_PASSENGER_QA217_HOME_V1",
 "checkout.readiness","Solicitar corrida","routeError","<CheckoutSummary />"]){
 if(!s.includes(required))throw Error("[FAIL] QA237 passenger baseline "+required);
}
once('import { useCheckoutPreparation } from "@/hooks/use-checkout-preparation";',
 'import { useCheckoutPreparation } from "@/hooks/use-checkout-preparation";\n'+
 'import { usePricing } from "@/hooks/use-pricing"; // '+marker,
 "pricing hook");
once('  const { route, status: routeStatus, error: routeError } = useRoute();',
 '  const { route, status: routeStatus, error: routeError, retry: qa237RetryRoute } = useRoute();',
 "existing route retry");
once('  const { checkout } = useCheckoutPreparation();',[
 '  const { checkout } = useCheckoutPreparation();',
 '  const { calculatePricing: qa237RetryPricing } = usePricing();',
 '  const [qa237Retrying,setQa237Retrying]=useState(false);',
 '  const qa237Reasons=checkout.blockingReasons;',
 '  const qa237RouteProblem=Boolean(routeError) || qa237Reasons.some(reason=>',
 '    reason==="route_missing" || reason==="route_outdated");',
 '  const qa237PricingProblem=qa237Reasons.some(reason=>',
 '    reason==="pricing_invalid" || reason==="pricing_outdated");',
 '  const qa237Recoverable=qa237RouteProblem || qa237PricingProblem;',
 '  const qa237BlockMessage=qa237Reasons.includes("passenger_debt_block")',
 '     ? "Sua carteira está bloqueada. Consulte a seção Carteira antes de solicitar."',
 '    : qa237Reasons.includes("insufficient_balance")',
 '     ? "Saldo insuficiente. Escolha outro pagamento ou adicione saldo."',
 '    : qa237Reasons.includes("payment_method_missing")',
 '     ? "Selecione uma forma de pagamento antes de solicitar."',
 '    : qa237Reasons.includes("category_missing")',
 '     ? "Selecione uma categoria disponível para a corrida."',
 '    : qa237Reasons.includes("user_not_authenticated")',
 '     ? "Sua sessão precisa ser renovada. Entre novamente para solicitar."',
 '    : qa237RouteProblem ? "A rota exibida não está atualizada para o embarque atual."',
 '    : qa237PricingProblem ? "O valor precisa ser recalculado antes da solicitação."',
 '    : !checkout.readiness ? "Ainda não foi possível validar todos os dados da corrida."',
 '    : routeError ? routeError : "";',
 '  const qa237Recover=async()=>{',
 '    if(qa237Retrying)return;',
 '    setQa237Retrying(true);',
 '    try{',
 '      // A fresh route automatically triggers pricing through the existing provider.',
 '      if(qa237RouteProblem)await qa237RetryRoute();',
 '      else if(qa237PricingProblem)await qa237RetryPricing();',
 '    }catch(error){console.warn("[APOIS Cliente] Falha ao atualizar percurso/preço",error);}',
 '    finally{setQa237Retrying(false);}',
 '  };'
].join("\n"),"booking cause feedback");

// Find the actual CTA rather than relying on a historical visual indentation.
const click='onClick={handleReview}';
const clickAt=s.indexOf(click);
if(clickAt<0||s.indexOf(click,clickAt+1)>=0)throw Error("[FAIL] QA237 request action missing/ambiguous");
const buttonAt=s.lastIndexOf("<button",clickAt);
if(buttonAt<0||clickAt-buttonAt>200)throw Error("[FAIL] QA237 cannot place notice before CTA");
const notice=[
'                {(!checkout.readiness || !!routeError) && (',
'                  <div data-apois-qa237-request-gate="true" role="status"',
'                    className="mb-3 rounded-2xl border border-[#F5CBCB] bg-[#FFF7F7] px-3 py-3 text-[#7C2424]">',
'                    <p className="text-[12px] font-semibold leading-relaxed">{qa237BlockMessage}</p>',
'                    {qa237Recoverable && (',
'                      <button type="button" onClick={()=>void qa237Recover()} disabled={qa237Retrying}',
'                        data-apois-qa237-retry="true"',
'                        className="mt-2 min-h-11 w-full rounded-xl border border-[#B91C2B] bg-white px-3 text-[13px] font-extrabold text-[#A91927] disabled:opacity-60">',
'                        {qa237Retrying ? "Atualizando percurso…" : "Atualizar percurso e valor"}',
'                      </button>',
'                    )}',
'                  </div>',
'                )}',
''].join("\n");
s=s.slice(0,buttonAt)+notice+s.slice(buttonAt);
for(const keep of [
 'disabled={!checkout.readiness || !!routeError}',
 'checkout.readiness && !routeError',
 'initiateReview();',
 'qa237Reasons.includes("payment_method_missing")',
 'qa237Reasons.includes("passenger_debt_block")',
 'qa237RetryPricing()','qa237RetryRoute()'
])if(!s.includes(keep))throw Error("[FAIL] QA237 lost "+keep);
writeFileSync(path,s,"utf8");
console.log("[OK] QA237 Cliente: actual disabled reason + guarded route/pricing retry, no request/payment bypass.");
