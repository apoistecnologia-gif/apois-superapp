import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(".work/partner-motorista");
const load=(p)=>readFileSync(resolve(root,p),"utf8");
const save=(p,v)=>writeFileSync(resolve(root,p),v,"utf8");
function once(src,from,to,name){let n=src.split(from).length-1;if(n!==1)throw Error("[FAIL] Existing passenger V7 "+name+" anchors="+n);return src.replace(from,to)}
const libPath="src/lib/driverRegistration.mobile.ts";
let lib=load(libPath);
if(!lib.includes("APOIS_DRIVER_REGISTRATION_PREFLIGHT_V6"))throw Error("[FAIL] expected registration V6");
lib=once(lib,'  documents: [DriverDocument, DriverDocument, DriverDocument, DriverDocument, DriverDocument];',
'  documents: [DriverDocument, DriverDocument, DriverDocument, DriverDocument, DriverDocument];\n  reuse_existing_account?: boolean;',"input contract");
const safeAuth=[
'  // APOIS_DRIVER_EXISTING_PASSENGER_ONBOARD_V7: verified existing account must NEVER call signUp.',
'  if(input.reuse_existing_account){',
'    const verified=await supabase.auth.signInWithPassword({email,password:input.password});',
'    if(verified.error || !verified.data.session || !verified.data.user)',
'      throw new Error("Não foi possível entrar nesta conta APOIS. Use a senha atual ou recupere o acesso; nenhum documento foi enviado.");',
'    return verified.data.user;',
'  }',
''].join("\n");
lib=once(lib,"  // First reuse an already-existing account only if its password is proven valid.",safeAuth+"  // First reuse an already-existing account only if its password is proven valid.","separate existing auth");
save(libPath,lib);
const formPath="src/routes/motorista.cadastro.tsx";
let form=load(formPath);
if(!form.includes("APOIS_DRIVER_SIGNUP_FORM_V4"))throw Error("[FAIL] signup V4 missing");
form=once(form,'import { cadastrarMotoristaMobile } from "@/lib/driverRegistration.mobile";',
'import { cadastrarMotoristaMobile } from "@/lib/driverRegistration.mobile";\nimport { supabase } from "@/integrations/supabase/client";',"supabase import");
form=once(form,'  const [birthDateDisplay, setBirthDateDisplay] = useState("");',[
'  const [birthDateDisplay, setBirthDateDisplay] = useState("");',
'  // APOIS_DRIVER_EXISTING_PASSENGER_ONBOARD_V7',
'  const [reuseExistingAccount,setReuseExistingAccount]=useState(()=>{',
'    try{return sessionStorage.getItem("apois-driver-existing-account-v7")==="1";}catch{return false;}',
'  });'
].join("\n"),"state");
const preflight=[
'  async function verifyExistingBeforePhotos():Promise<boolean>{',
'    const form=formRef.current;',
'    if(!form)return false;',
'    const values=new FormData(form);',
'    const email=String(values.get("email")||"").trim().toLowerCase();',
'    const password=String(values.get("password")||"");',
'    setLoading(true);',
'    try{',
'      const {data,error:authError}=await supabase.auth.signInWithPassword({email,password});',
'      if(authError||!data.session||!data.user){',
'        setError("Conta APOIS existente: confira a senha atual ou recupere o acesso. Nenhuma fotografia foi enviada.");',
'        return false;',
'      }',
'      const {data:profileId,error:profileError}=await supabase.rpc("mobility_user_id");',
'      if(profileError||!profileId){',
'        setError("Conta autenticada, mas o perfil interno está indisponível. Procure o suporte APOIS antes de anexar documentos.");',
'        return false;',
'      }',
'      const {data:driver,error:driverError}=await supabase.rpc("driver_get_profile");',
'      if(driverError){setError("Não foi possível verificar o cadastro de motorista; tente novamente.");return false;}',
'      if(driver&&typeof driver==="object"&&!Array.isArray(driver)&&"id" in driver){',
'        setError("Já existe cadastro de Motorista para esta conta. Consulte o status no Perfil; não envie novamente os documentos.");',
'        return false;',
'      }',
'      setError(null);return true;',
'    }catch{setError("Falha de conexão. Não foi enviado nenhum arquivo.");return false;}',
'    finally{setLoading(false);}',
'  }',
'',
'  async function nextStep() {'
].join("\n");
form=once(form,"  function nextStep() {",preflight,"preflight before document step");
form=once(form,"    else if (step === 2 && validateStep(2)) setStep(3);",
"    else if (step === 2 && validateStep(2) && (!reuseExistingAccount || await verifyExistingBeforePhotos())) setStep(3);","step condition");
form=once(form,"        documents: documents as any,","        documents: documents as any,\n        reuse_existing_account: reuseExistingAccount,","mode to backend");
const toggle=[
'              {/* APOIS_DRIVER_EXISTING_PASSENGER_ONBOARD_V7 */}',
'              <label data-apois-existing-passenger-v7 className="my-3 flex min-w-0 items-start gap-3 rounded-2xl border border-[#f0bec2] bg-white p-4 text-sm leading-5 text-[#111827]">',
'                <input type="checkbox" aria-label="Já tenho conta APOIS Passageiro" checked={reuseExistingAccount}',
'                  onChange={(event)=>{setReuseExistingAccount(event.currentTarget.checked);try{',
'                    if(event.currentTarget.checked)sessionStorage.setItem("apois-driver-existing-account-v7","1");',
'                    else sessionStorage.removeItem("apois-driver-existing-account-v7");',
'                  }catch{}}} className="mt-1 h-5 w-5 shrink-0 accent-[#D91521]" />',
'                <span><strong>Já tenho conta APOIS Passageiro (ou outro perfil).</strong> Usar meu e-mail e minha senha atuais para acrescentar Motorista, sem criar outra conta.</span>',
'              </label>',
'              '
].join("\n");
form=once(form,'<FieldShell label="Senha" icon={LockKeyhole}>',toggle+'<FieldShell label="Senha" icon={LockKeyhole}>',"form account toggle");
form=once(form,'onClick={nextStep}', 'onClick={() => void nextStep()} disabled={loading}',"async next button");
save(formPath,form);
const loginPath="src/routes/motorista.login.tsx";
let login=load(loginPath);
if(!login.includes("APOIS_DRIVER_SIGNUP_FORM_V4"))throw Error("[FAIL] login V4 missing");
login=once(login,
'if (profileResult.reason === "not_found") setError("Cadastro de motorista não encontrado. Use a opção de cadastro para concluir seu perfil.");',
[
'if (profileResult.reason === "not_found") {',
'           try{sessionStorage.setItem("apois-driver-existing-account-v7","1");}catch{}',
'           setRegistrationNotice(false);',
'           setError("A conta APOIS está autenticada, mas ainda não possui cadastro de Motorista. Toque em Continuar cadastro com esta conta.");',
'         }'
].join("\n"),"driver absent");
const button=[
'          {error?.includes("Continuar cadastro com esta conta") ? (',
'            <button type="button" data-apois-existing-driver-cta-v7',
'              onClick={()=>navigate({to:"/motorista/cadastro"})}',
'              className="min-h-12 w-full rounded-xl border border-[#f0bec2] bg-white p-3 text-sm font-extrabold text-[#B71922]">',
'              Continuar cadastro de motorista com esta conta',
'            </button>) : null}',
'          '
].join("\n");
login=once(login,'          {error ? <div role="alert"',button+'{error ? <div role="alert"',"onboarding CTA");
save(loginPath,login);
console.log("[OK] V7: authenticated passenger onboarding has separate signIn-only path and preflight BEFORE uploading 13 photos.");
