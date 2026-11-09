import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {test} from "node:test";
import {patchRecover,patchReset,MARK} from "../fix-corridas-auth-visual15-v1.mjs";

const root=resolve(import.meta.dirname,"../..");
const work=resolve(root,".work/corridas");
const readWork=(path)=>readFileSync(resolve(work,path),"utf8");
const readRepo=(path)=>readFileSync(resolve(root,path),"utf8");
function publicError(){
  const template=readWork("src/lib/apoisPassengerPublicAuthError.ts");
  assert.equal(template,readRepo("scripts/templates/apoisPassengerPublicAuthError.ts"));
  const js=template
    .replace(/^export type PassengerAuthAction = .*;\n/m,"")
    .replace("export function passengerPublicAuthError(error: unknown, action: PassengerAuthAction): string {",
      "function passengerPublicAuthError(error, action) {")
    .replace("error as {code?: unknown;message?: unknown;status?: unknown}","error");
  return new Function(js+"\nreturn passengerPublicAuthError;")();
}
test("CV-054 / VIS-055: known and unknown recover/reset failures are public Portuguese guidance",()=>{
  const display=publicError();
  assert.match(display({status:429,code:"over_request_rate_limit"},"recover"),/Muitas tentativas/);
  assert.match(display({message:"Failed to fetch"},"recover"),/conectar ao servidor/);
  assert.match(display({code:"email_address_invalid"},"recover"),/e-mail/);
  assert.match(display({code:"weak_password"},"reset"),/requisitos de segurança/);
  assert.match(display({code:"otp_expired"},"reset"),/link de recuperação/);
  const unknown=display({message:"SQL exception: internal_database_state_xyz"},"recover");
  assert.match(unknown,/Não foi possível solicitar/);
  assert.doesNotMatch(unknown,/SQL|internal_database_state_xyz/);
  const resetUnknown=display({message:"unexpected provider internals"},"reset");
  assert.match(resetUnknown,/Não foi possível atualizar a senha/);
  assert.doesNotMatch(resetUnknown,/provider/);
});
test("CV-054 / VIS-055: live auth methods and successful-state messages remain unchanged",()=>{
  const recover=readWork("src/routes/_public.recuperar-senha.tsx");
  const reset=readWork("src/routes/_public.redefinir-senha.tsx");
  assert.ok(recover.includes(MARK)&&reset.includes(MARK));
  assert.equal(patchRecover(recover),recover,"recover patch idempotent");
  assert.equal(patchReset(reset),reset,"reset patch idempotent");
  for(const token of ["resetPasswordForEmail(email.trim().toLowerCase()",
    "Capacitor.isNativePlatform()","br.com.apois.app://auth/corridas-reset",
    "setSent(true)","Instruções enviadas para o seu e-mail."]){
    assert.ok(recover.includes(token),token);
  }
  for(const token of ["exchangeCodeForSession(code)","supabase.auth.setSession",
    "supabase.auth.updateUser({","setIsValidSession(true)","Senha atualizada com sucesso!",
    "if (password.length < 6)"]){
    assert.ok(reset.includes(token),token);
  }
  assert.ok(!recover.includes("toast.error(error.message)"));
  assert.ok(!reset.includes("toast.error(error.message)"));
  assert.ok(recover.includes('toast.error(passengerPublicAuthError(error, "recover"))'));
  assert.ok(reset.includes('toast.error(passengerPublicAuthError(error, "reset"))'));
  assert.ok(recover.includes("console.error(")&&reset.includes("console.error("));
});
test("VIS-032/035/004: labels target existing inputs; single reveal has toggle label and 44px hit target",()=>{
  const recover=readWork("src/routes/_public.recuperar-senha.tsx");
  const reset=readWork("src/routes/_public.redefinir-senha.tsx");
  assert.ok(recover.includes('htmlFor="apois-recover-email"'));
  assert.ok(recover.includes('id="apois-recover-email"'));
  assert.ok(recover.includes('autoComplete="email"'));
  for(const id of ["apois-reset-password","apois-reset-confirm-password"]){
    assert.ok(reset.includes('htmlFor="'+id+'"'),id+" label");
    assert.ok(reset.includes('id="'+id+'"'),id+" input");
  }
  assert.equal(reset.split('autoComplete="new-password"').length-1,2);
  assert.ok(reset.includes('aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}'));
  assert.ok(reset.includes('aria-pressed={showPassword}'));
  assert.ok(reset.includes('aria-controls="apois-reset-password"'));
  assert.ok(reset.includes("min-h-11 min-w-11"));
  assert.ok(reset.includes("onClick={() => setShowPassword(!showPassword)}"));
});
test("VIS-054: local 8/alphanumeric signup vs 6-only reset mismatch explicitly remains pending server policy",()=>{
  const signup=readWork("src/routes/_public.cadastro.tsx");
  const reset=readWork("src/routes/_public.redefinir-senha.tsx");
  assert.ok(signup.includes('password.length < 8 || !/[A-Za-z]/.test(password) || !/\\d/.test(password)'));
  assert.ok(reset.includes('if (password.length < 6)'));
  assert.ok(reset.includes("A senha deve ter pelo menos 6 caracteres."));
  // Deliberate contract hold: never declare this inconsistency resolved until policy is confirmed.
});
test("RV-15: ordered in isolated builder, source lock pinned and public contrast not undone",()=>{
  const builder=readRepo("scripts/build-isolated-module.mjs");
  assert.ok(builder.includes("fix-corridas-auth-visual15-v1.mjs"));
  assert.ok(builder.includes("test-corridas-auth-visual15-v1.test.mjs"));
  assert.ok(builder.indexOf("harden-corridas-password-recovery.mjs") <
    builder.indexOf("fix-corridas-auth-visual15-v1.mjs"));
  assert.ok(builder.indexOf("fix-corridas-active-ride-visual14-v1.mjs") <
    builder.indexOf("fix-corridas-auth-visual15-v1.mjs"));
  const contrast=readWork("src/routes/_public.recuperar-senha.tsx");
  assert.ok(contrast.includes("data-apois-corridas-public-form-contrast-v1"));
  const lock=JSON.parse(readRepo(".apois/source-lock.json"));
  assert.equal(lock.sources.corridas_passageiro.commit,"7b047f75a1a919a5336c0df6e0d60b14b02f2618");
});
