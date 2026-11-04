import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(".work/corridas/src/routes/_public.cadastro.tsx");
let source = readFileSync(file,"utf8");
const old = 'toast.info("Conta criada. Confirme seu e-mail para entrar.");';
const next = 'toast.info("Se o e-mail ainda não estiver cadastrado, confira a mensagem de confirmação. Se já tiver conta, use Entrar com Google ou a recuperação de senha.", { duration: 9000 }); // APOIS_SIGNUP_NEUTRAL_FEEDBACK_V1';
if (source.includes(old)) {
  source=source.replace(old,next);
  writeFileSync(file,source,"utf8");
}
if (!source.includes("APOIS_SIGNUP_NEUTRAL_FEEDBACK_V1") || source.includes(old)) {
 throw new Error("[FAIL] Cadastro: feedback ambíguo não foi corrigido");
}
console.log("[OK] Cadastro: retorno do Supabase não afirma criação nem revela existência do e-mail");
