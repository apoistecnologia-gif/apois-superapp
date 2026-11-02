import{readFileSync,writeFileSync}from"node:fs";
import{resolve}from"node:path";
// APOIS_MOTORISTA_PASSWORD_RESULT_V2: light form readability + explicit success.
const root=resolve(".work/partner-motorista");
const read=p=>readFileSync(resolve(root,p),"utf8");
const write=(p,s)=>writeFileSync(resolve(root,p),s,"utf8");
function one(s,a,b,label){let n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] Password V2 "+label+" anchors="+n);return s.replace(a,b)}
const resetPath="src/routes/motorista.redefinir-senha.tsx";
let reset=read(resetPath);
if(!reset.includes('await navigate({ to: "/motorista/login", replace: true });'))
 throw Error("[FAIL] reset must already route to login");
reset=one(reset,
'      await supabase.auth.signOut();',
'      // APOIS_MOTORISTA_PASSWORD_RESULT_V2: no password or token is stored.\n'+
'      try{sessionStorage.setItem("apois-driver-password-updated-v2","1");}catch{}\n'+
'      await supabase.auth.signOut();',"success message flash");
// Native Android autofill and password-reveal styles MUST be readable on white.
// Both password fields share the exact same input class.
const resetInput='className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold outline-none"';
if(reset.split(resetInput).length!==3)throw Error("[FAIL] expected two reset inputs");
reset=reset.replaceAll(resetInput,
'style={{color:"#111827",WebkitTextFillColor:"#111827",caretColor:"#111827",colorScheme:"light"}} '+
'className="h-full min-w-0 flex-1 bg-transparent text-base font-semibold text-[#111827] outline-none"');
reset=one(reset,'Link confirmado</p>','Código verificado</p>',"OTP success wording");
write(resetPath,reset);
const loginPath="src/routes/motorista.login.tsx";
let login=read(loginPath);
if(!login.includes("APOIS_DRIVER_EXISTING_PASSENGER_ONBOARD_V7"))throw Error("[FAIL] login missing V7 onboarding");
login=one(login,'  const [registrationNotice, setRegistrationNotice] = useState(false);',
'  const [registrationNotice, setRegistrationNotice] = useState(false);\n'+
'  const [passwordUpdatedNotice,setPasswordUpdatedNotice]=useState(false);\n'+
'  // APOIS_MOTORISTA_PASSWORD_RESULT_V2',"success state");
const hook=[
'  useEffect(()=>{',
'    try{',
'      if(sessionStorage.getItem("apois-driver-password-updated-v2")==="1"){',
'        sessionStorage.removeItem("apois-driver-password-updated-v2");',
'        setRegistrationNotice(false);',
'        setPasswordUpdatedNotice(true);',
'      }',
'    }catch{}',
'  },[]);',
'',
].join("\n");
login=one(login,'  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {',
hook+'  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {',"flash lifecycle");
login=one(login,'          {registrationNotice ? <div role="status"',
'          {passwordUpdatedNotice ? <div data-apois-driver-password-updated-v2 role="status" aria-live="polite" className="rounded-xl border border-[#99e5b9] bg-[#effcf4] p-4 text-sm font-semibold leading-6 text-[#14532D]">Senha alterada com sucesso. Entre com sua nova senha. Esta alteração também atualiza o acesso da conta compartilhada com o APOIS Passageiro.</div> : null}\n'+
'          {registrationNotice ? <div role="status"',"success banner");
write(loginPath,login);
console.log("[OK] Motorista: visible reset password text incl. native autofill, OTP wording and explicit post-update success banner.");
