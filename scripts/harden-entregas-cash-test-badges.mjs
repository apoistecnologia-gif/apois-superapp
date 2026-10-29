import { readFileSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Build of customer test copy only; default production may NOT enable this.
if (process.env.APOIS_ENTREGAS_CASH_TEST_MODE !== "1")
  throw Error("[FAIL] Cash badge allowed only in controlled homologation build");
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const marker="APOIS_CASH_TEST_ONLY_V1";
function patch(file,find,replace) {
 const path=resolve(root,file);let s=readFileSync(path,"utf8");
 if(s.includes(marker))return;
 if(!s.includes(find))throw Error("[FAIL] Texto de teste ausente "+file);
 s=s.replaceAll(find,replace);
 s += "\n// "+marker+"\n";
 writeFileSync(path,s,"utf8");
}
patch("src/routes/sacola.tsx",
 "Pagamento direto ao estabelecimento",
 "DINHEIRO — TESTE, NÃO PAGAR");
patch("src/routes/checkout.tsx",
 "Pagamento direto ao estabelecimento",
 "DINHEIRO — TESTE, NÃO PAGAR");
const file=resolve(root,"src/routes/checkout.tsx");
let s=readFileSync(file,"utf8");
if(!s.includes("Nenhum dinheiro deve ser entregue ou cobrado")){
 s=s.replace('toast.success("Pedido criado. O pagamento será feito diretamente ao estabelecimento.");',
  'toast.success("PEDIDO DE TESTE CRIADO. Nenhum dinheiro deve ser entregue ou cobrado.");');
 if(!s.includes("Nenhum dinheiro deve ser entregue ou cobrado"))throw Error("[FAIL] Aviso final ausente");
 writeFileSync(file,s,"utf8");
}
console.log("[OK] Entregas homologação: dinheiro visível apenas no build TESTE, sem cobrança.");
