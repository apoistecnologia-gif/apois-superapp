import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const path=resolve(".work/partner-motorista/src/lib/driverRegistration.mobile.ts");
let code=readFileSync(path,"utf8");
const anchor="  const authUser = await ensureAuthenticatedAccount(input);";
if(code.split(anchor).length!==2 || !code.includes("APOIS_DRIVER_AUTH_RESUME_V5"))
 throw Error("[FAIL] Driver registration V6: authentication contract changed");
// APOIS_DRIVER_REGISTRATION_PREFLIGHT_V6: prohibit duplicate registration, orphan
// uploads, and resetting the approval state of any existing driver.
const check=`
  // APOIS_DRIVER_REGISTRATION_PREFLIGHT_V6
  // First authenticate, then prove that the internal user profile exists.
  const { data: mobilityId, error: mobilityError } = await supabase.rpc("mobility_user_id");
  if (mobilityError) {
    throw new Error("Não foi possível validar seu perfil interno. Tente novamente após fazer login.");
  }
  if (typeof mobilityId !== "string" || !mobilityId) {
    throw new Error("Sua conta de acesso existe, mas o perfil interno ainda não foi criado. Não refaça o cadastro com outro e-mail. Procure o suporte APOIS para regularizar o vínculo.");
  }

  const { data: existingDriver, error: verifyError } = await supabase.rpc("driver_get_profile");
  if (verifyError) {
    throw new Error("Não foi possível verificar se você já é motorista. Nenhum documento foi enviado. Tente novamente mais tarde.");
  }
  if (existingDriver && typeof existingDriver === "object" && !Array.isArray(existingDriver) && typeof existingDriver.id === "string" && existingDriver.id) {
    throw new Error("Esta conta já possui cadastro de motorista. Entre no aplicativo e consulte o status em Perfil. Não é necessário repetir o cadastro nem enviar novas fotos.");
  }
`;
code=code.replace(anchor,anchor+check);
if(!code.includes("APOIS_DRIVER_REGISTRATION_PREFLIGHT_V6") || code.split("driver_get_profile").length!==2)
 throw Error("[FAIL] Driver registration V6: check incomplete");
writeFileSync(path,code,"utf8");
console.log("[OK] Motorista QA: authenticated user must have internal profile; duplicate driver registrations blocked before uploads.");
