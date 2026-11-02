import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const path=resolve(".work/partner-motorista/src/lib/driverRegistration.mobile.ts");
let s=readFileSync(path,"utf8");
function replace(from,to,label){const n=s.split(from).length-1;if(n!==1)throw Error("[FAIL] Auth V5 "+label+" anchors="+n);s=s.replace(from,to);}
if(!s.includes("APOIS_VEHICLE_INSPECTION_UPLOAD_V1"))throw Error("[FAIL] Missing 13-photo registration upload baseline");
if(s.includes("APOIS_DRIVER_AUTH_RESUME_V5"))throw Error("[FAIL] Already patched");
const start=s.indexOf("async function ensureAuthenticatedAccount(input: DriverRegistrationInput) {");
const end=s.indexOf("\nexport async function cadastrarMotoristaMobile",start);
if(start<0||end<start)throw Error("[FAIL] Auth registration contract moved");
const block=`// APOIS_DRIVER_AUTH_RESUME_V5: avoid treating Supabase obfuscated duplicate signups as created accounts.
// Only report new account if the provider returned a new identity and an authenticated session exists.
async function ensureAuthenticatedAccount(input: DriverRegistrationInput) {
  const email = input.email.trim().toLowerCase();
  // First reuse an already-existing account only if its password is proven valid.
  // This permits the driver to finish registration after email confirmation without creating another user.
  const existing = await supabase.auth.signInWithPassword({email,password:input.password});
  if (!existing.error && existing.data.user && existing.data.session) return existing.data.user;
  if (existing.error && /network|fetch|timeout|429|rate limit|too many/i.test(existing.error.message))
    throw new Error("Não foi possível verificar sua conta. Confira a conexão e tente novamente.");

  const signup = await supabase.auth.signUp({
    email,
    password:input.password,
    options:{data:{role:"driver",name:input.name.trim(),full_name:input.name.trim(),phone:input.phone.trim()}},
  });
  if (signup.error) {
    if (/already|registered|exists|duplicate/i.test(signup.error.message))
      throw new Error("Este e-mail já está cadastrado. Entre usando a senha dessa conta ou recupere sua senha.");
    throw new Error(readableAuthError(signup.error.message));
  }
  if (signup.data.session && signup.data.user) return signup.data.user;
  // Supabase may deliberately return an obfuscated user for an existing address.
  // Never claim an account was created or that the documents were submitted.
  if (signup.data.user && Array.isArray(signup.data.user.identities) && signup.data.user.identities.length === 0)
    throw new Error("Este e-mail pode já estar cadastrado. Verifique sua caixa de entrada, tente entrar ou recupere sua senha. Nenhum documento foi enviado.");
  throw new Error("Verifique a caixa de entrada do e-mail informado. Se receber uma confirmação, conclua-a e entre com o mesmo e-mail e senha para finalizar o cadastro. Nenhum documento foi enviado.");
}
`;
s=s.slice(0,start)+block+s.slice(end);
replace('    return {\n      ok: true as const,','    const { data: verified, error: verifyError } = await (supabase as any).from("drivers").select("id,approval_status").eq("user_id",authUser.id).maybeSingle();\n    if (verifyError || !verified?.id) throw new Error("Cadastro processado, mas a confirmação do perfil não foi possível. Entre novamente para verificar a situação antes de reenviar.");\n    return {\n      ok: true as const,',"read-after-write");
// Preserve the registration form UX V4, but show an accurate status at login.
const formPath=resolve(".work/partner-motorista/src/routes/motorista.cadastro.tsx");
let form=readFileSync(formPath,"utf8");
const old='err.message === "Conta criada. Confirme seu e-mail e depois entre para concluir o cadastro."';
if(form.split(old).length!==2)throw Error("[FAIL] V4 confirmation handling moved");
form=form.replace(old,'err.message.includes("Nenhum documento foi enviado.")');
writeFileSync(formPath,form,"utf8");
const loginPath=resolve(".work/partner-motorista/src/routes/motorista.login.tsx");
let login=readFileSync(loginPath,"utf8");
const oldText='Sua conta de acesso foi criada. Confirme o e-mail recebido e depois entre. ';
if(login.split(oldText).length!==2)throw Error("[FAIL] V4 login confirmation notice moved");
login=login.replace(oldText,'Verifique seu e-mail. Se recebeu uma confirmação, conclua-a e depois entre. Se a conta já existia, use sua senha ou a recuperação de acesso. ');
writeFileSync(loginPath,login,"utf8");
writeFileSync(path,s,"utf8");
console.log("[OK] Driver signup resumes existing confirmed account and never falsely claims a new account on obfuscated signup.");
