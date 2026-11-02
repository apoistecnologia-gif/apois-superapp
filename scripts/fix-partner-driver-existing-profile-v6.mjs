import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path=resolve(".work/partner-motorista/src/lib/driverRegistration.mobile.ts");
let s=readFileSync(path,"utf8");
if(!s.includes("APOIS_DRIVER_AUTH_RESUME_V5"))throw Error("[FAIL] auth resume V5 missing");
if(s.includes("APOIS_DRIVER_EXISTING_PROFILE_GUARD_V6"))throw Error("[FAIL] guard applied twice");
const before='  const authUser = await ensureAuthenticatedAccount(input);';
if(s.split(before).length!==2)throw Error("[FAIL] auth guard insertion point moved");
// Real RPC driver_get_profile returns jsonb|null and verifies auth.uid; must not
// call the upsert RPC for an already-existing driver, as it resets approval.
const after=`  const authUser = await ensureAuthenticatedAccount(input);
  // APOIS_DRIVER_EXISTING_PROFILE_GUARD_V6
  const { data: existingDriver, error: verifyError } = await (supabase as any).rpc("driver_get_profile");
  if (verifyError) {
    throw new Error("Não foi possível verificar seu cadastro no servidor. Nenhum arquivo foi enviado. Tente entrar novamente.");
  }
  if (existingDriver && typeof existingDriver === "object" && existingDriver.id) {
    const status=String(existingDriver.approval_status ?? "").toLowerCase();
    throw new Error(status === "aprovado"
      ? "Você já possui cadastro de motorista aprovado. Entre na sua conta; não é necessário refazer o cadastro."
      : "Este motorista já possui cadastro. Consulte o status e as pendências na sua conta; não envie outro cadastro.");
  }`;
s=s.replace(before,after);
if(!s.includes("APOIS_DRIVER_EXISTING_PROFILE_GUARD_V6"))throw Error("[FAIL] existing account safeguard not applied");
writeFileSync(path,s,"utf8");
console.log("[OK] Approved/pending drivers cannot be overwritten via another registration.");
