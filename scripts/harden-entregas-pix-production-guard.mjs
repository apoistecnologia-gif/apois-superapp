import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
if(process.env.APOIS_ENTREGAS_CASH_TEST_MODE==="1")
  throw Error("[FAIL] Production Pix guard cannot run in cash test mode");
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const checkout=resolve(root,"src/routes/checkout.tsx");
const sacola=resolve(root,"src/routes/sacola.tsx");
let source=readFileSync(checkout,"utf8");
const entry='  const handleConfirm = async () => {';
if(!source.includes(entry))throw Error("[FAIL] checkout handler unavailable");
if(source.includes('const paymentMethod = "cash";') || source.includes('paymentMethod: "cash"'))
  throw Error("[FAIL] Cash must not be offered by the production Entregas customer");
source=source.replace(entry,entry+[
  '',
  '    // APOIS_ENTREGAS_PIX_PRODUCTION_GUARD_V1',
  '    // Historical PIX gateway is retired; do not create orphan order.',
  '    if (true) {',
  '      toast.error("PIX temporariamente indisponível. Nenhum pedido ou cobrança foi criado.");',
  '      return;',
  '    }',
  '',
].join("\n"));
if(!source.includes("APOIS_ENTREGAS_PIX_PRODUCTION_GUARD_V1"))throw Error("[FAIL] missing Pix guard");
writeFileSync(checkout,source,"utf8");
let cart=readFileSync(sacola,"utf8");
cart=cart.replaceAll("PIX habilitado","PIX em preparação");
cart=cart.replaceAll("Pagamento disponível e confirmado automaticamente.","O PIX estará disponível quando a integração Safe2Pay estiver habilitada.");
writeFileSync(sacola,cart,"utf8");
console.log("[OK] Entregas produção: somente PIX, sem cobrança enquanto Safe2Pay estiver inativo.");
