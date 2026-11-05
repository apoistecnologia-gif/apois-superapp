// FI-01: do not promise a Pix checkout where the approved release has no billing provider.
import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
function rewrite(path,old,next){const p=resolve(root,path);let s=readFileSync(p,"utf8");const n=s.split(old).length-1;if(n!==1)throw Error("[FAIL] Finance CTA "+path+" count="+n);s=s.replace(old,next);writeFileSync(p,s,"utf8");}
rewrite("src/routes/motorista.app.tsx","              Pagar mensalidade\n","              Consultar mensalidade\n");
rewrite("src/routes/motorista.perfil.tsx",'sub="Status, pagamento Pix e comprovante"','sub="Contrato, vencimento e formas de pagamento disponíveis"');
console.log("[OK] Motorista: financial CTAs state contract consultation, not unavailable Pix checkout.");
