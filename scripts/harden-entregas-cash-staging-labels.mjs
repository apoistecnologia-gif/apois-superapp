/**
 * Executar somente no workspace de uma build de homologação.
 * NÃO ligar este script ao pipeline de produção ou às Actions atuais.
 * Pré-condições obrigatórias: URL Supabase de STAGING e chave sem produção.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
const url = String(process.env.VITE_SUPABASE_URL || "");
const mode = process.env.APOIS_HOMOLOGATION_CASH;
const production = new Set(["ptgkwyyolrdgnqketkjj","sbvhdgyuuperszlsllji","tbbzkrfupmqdywnzgnms","vqtucstyduxrqjgyigfk"]);
let ref = "";
try {
  const u = new URL(url);
  if (u.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/i.test(u.hostname))
    throw Error("Supabase inválido");
  ref = u.hostname.split(".")[0];
} catch { throw Error("[FAIL] Indique VITE_SUPABASE_URL de staging válida."); }
if (mode !== "enabled-in-staging" || production.has(ref)) {
  throw Error("[FAIL] Labels de simulação exigem APOIS_HOMOLOGATION_CASH=enabled-in-staging e Supabase diferente de produção.");
}
function patch(file, changes) {
  const path = resolve(root, file);
  let content = readFileSync(path, "utf8");
  if (content.includes("APOIS_CASH_STAGING_VISUAL_V1")) {
    console.log("[OK] Labels já aplicados: "+file); return;
  }
  for (const [before, after] of changes) {
    if (!content.includes(before)) throw Error("[FAIL] Texto esperado ausente em "+file+": "+before);
    content = content.replaceAll(before, after);
  }
  content += "\n// APOIS_CASH_STAGING_VISUAL_V1\n";
  writeFileSync(path, content, "utf8");
}
patch("src/routes/checkout.tsx", [
  ["Pagamento direto ao estabelecimento", "Pagamento em dinheiro — TESTE (não pagar)"],
  ["Pedido criado. O pagamento será feito diretamente ao estabelecimento.", "Pedido de TESTE criado. Nenhum dinheiro deve ser entregue ou cobrado."],
]);
patch("src/routes/sacola.tsx", [
  ["Pagamento direto ao estabelecimento", "Pagamento em dinheiro — TESTE (não pagar)"],
  ["O aplicativo não processa nem confirma este pagamento eletronicamente.", "HOMOLOGAÇÃO: esta compra é simulada. Não pague nenhum valor ao estabelecimento."],
]);
console.log("[OK] Homologação Cash: textos de teste explícitos; nenhum pagamento ou API acessado.");
