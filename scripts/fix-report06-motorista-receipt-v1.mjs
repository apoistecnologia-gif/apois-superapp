// Relatorio 06 / INV-052: preserve unknown amounts and metrics in the Driver PDF.
// Runs only after the existing receipt visual/payment hardener in the isolated .work tree.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const file=resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista","src/lib/driverReceipt.ts");
const marker="APOIS_REPORT06_RECEIPT_NULL_SAFE_V1";
const original=readFileSync(file,"utf8");
function once(text,from,to,label) {
 const count=text.split(from).length-1;
 if(count!==1)throw Error("[FAIL] INV-052 "+label+" anchors="+count);
 return text.replace(from,to);
}
if(original.includes(marker)){
 for(const check of ["typeof value === \"string\" && value.trim() === \"\"","Valor estimado da corrida","Valor indisponível"]) {
  if(!original.includes(check))throw Error("[FAIL] INV-052 incomplete "+check);
 }
 console.log("[OK] INV-052 receipt patch previously applied");
} else {
 let next=once(original,
  '  const parsed = Number(value);',
  '  // APOIS_REPORT06_RECEIPT_NULL_SAFE_V1: absence is not the numeric value zero.\n  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;\n  const parsed = Number(value);',
  "null-safe price and metric");
 next=once(next,
  'doc.text("Valor da corrida", 20, finalY + 19);',
  'doc.text(finalPrice === null && estimatedPrice !== null ? "Valor estimado da corrida" : "Valor da corrida", 20, finalY + 19);',
  "estimate label");
 next=once(next,
  '"A APOIS não retém comissão nem recebe o valor da corrida; o pagamento é destinado diretamente ao motorista.",',
  'finalPrice === null && estimatedPrice !== null\n      ? "Valor estimado, não comprova pagamento. A APOIS não retém comissão por corrida."\n      : "A APOIS não retém comissão nem recebe o valor da corrida; o pagamento é destinado diretamente ao motorista.",',
  "payment disclaimer");
 writeFileSync(file,next,"utf8");
 console.log("[OK] INV-052: receipt keeps missing data unavailable, legit zero, and estimate label");
}
