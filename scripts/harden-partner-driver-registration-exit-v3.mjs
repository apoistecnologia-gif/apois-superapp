import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const file=resolve(root,"src/routes/motorista.cadastro.tsx"),cssFile=resolve(root,"src/styles.css");
let src=readFileSync(file,"utf8");
function once(s,a,b,label){const n=s.split(a).length-1;if(n!==1)throw Error("[FAIL] Motorista V3 "+label+" matches="+n);return s.replace(a,b);}
if(src.includes("APOIS_DRIVER_REGISTRATION_EXIT_V3"))throw Error("[FAIL] duplicate driver signup patch");
src=once(src,'import { translateAuthError } from "@/lib/authErrors";',
'import { translateAuthError } from "@/lib/authErrors";\nimport { signOutDriverOnThisDevice } from "@/lib/driverLocalSignOut";',"existing local logout");
const a=src.indexOf("function SuccessScreen()"),b=src.indexOf("function DriverSignUpPage()",a);
if(a<0||b<a)throw Error("[FAIL] success component");
let success=src.slice(a,b);
success=once(success,'  const navigate = useNavigate();',
'  const navigate = useNavigate();\n  const [exitError, setExitError] = useState<string | null>(null);\n  const exitSuccess = async () => {\n    try { await signOutDriverOnThisDevice(); }\n    catch { setExitError("Não foi possível retornar ao login. Tente novamente."); }\n  };',"success exit");
success=once(success,'onClick={() => window.location.replace("../../index.html")}',
'onClick={() => void exitSuccess()}',"success CTA action");
success=once(success,'>Trocar perfil de parceiro</button>','>Sair para o login</button>',"success exit CTA");
success=once(success,'<div className="mt-6 space-y-2">',
'<div className="mt-6 space-y-2">\n          {exitError ? <p role="alert" className="rounded-xl bg-[#FFF1F2] px-3 py-2 text-xs font-semibold text-[#B91C1C]">{exitError}</p> : null}',"success error message");
success=once(success,'<div className="min-h-[100dvh] min-w-0 bg-[#050607] text-white">',
'<div data-apois-driver-signup-success-v3 className="min-h-[100dvh] min-w-0 bg-[#F7F7F8] text-[#111827]">',"success light theme");
src=src.slice(0,a)+success+src.slice(b);
const p=src.indexOf("function DriverSignUpPage()"),q=src.indexOf("\nfunction StepHeading(",p);
if(p<0||q<p)throw Error("[FAIL] signup page");
let form=src.slice(p,q);
form=once(form,'  function previousStep() {',
'  // APOIS_DRIVER_REGISTRATION_EXIT_V3\n  async function exitRegistration() {\n    if (loading) return;\n    try { await signOutDriverOnThisDevice(); }\n    catch { setError("Não foi possível retornar ao login. Tente novamente."); }\n  }\n\n  function previousStep() {',"exit handler");
form=once(form,
'    if (step === 1) {\n      window.location.replace("../../index.html");\n      return;\n    }',
'    if (step === 1) {\n      void exitRegistration();\n      return;\n    }',"first step back");
form=once(form,'<div className="min-h-[100dvh] min-w-0 bg-[#050607] text-white">',
'<div data-apois-driver-signup-v3 className="min-h-[100dvh] min-w-0 bg-[#F7F7F8] text-[#111827]">',"form theme");
form=once(form,'border-b border-white/5 bg-[#050607]/95','border-b border-[#E5E7EB] bg-white/95',"form top");
const main='      <main className="mx-auto w-full max-w-md min-w-0 px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-6">';
form=once(form,main,main+"\n        <div className=\"mb-4 flex justify-end\">\n          <button type=\"button\" disabled={loading} onClick={() => void exitRegistration()}\n            aria-label=\"Sair do cadastro e voltar ao login\"\n            className=\"inline-flex min-h-11 items-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-bold text-[#B91C1C] shadow-sm disabled:opacity-50\">\n            Sair do cadastro e voltar ao login\n          </button>\n        </div>","always visible logout");
form=form.replaceAll("bg-[#0D0F11]","bg-white").replaceAll("bg-[#101214]","bg-white")
.replaceAll("text-zinc-300","text-[#475467]").replaceAll("text-zinc-400","text-[#596372]")
.replaceAll("text-zinc-500","text-[#667085]").replaceAll("text-zinc-600","text-[#667085]");
form=form.replace(/(bg-\[#E51B23\][^"]*)text-black/g,"$1text-white");
src=src.slice(0,p)+form+src.slice(q);
src=src.replaceAll("#F6BE1C","#E51B23").replaceAll("rgba(246,190,28","rgba(229,27,35");
if(!src.includes("void exitRegistration()")||!src.includes("Sair para o login"))throw Error("[FAIL] exit links missing");
writeFileSync(file,src,"utf8");
let styles=readFileSync(cssFile,"utf8");
if(styles.includes("APOIS_DRIVER_REGISTRATION_CONTRAST_V3"))throw Error("[FAIL] duplicate style");
styles+="\n/* APOIS_DRIVER_REGISTRATION_CONTRAST_V3 - signup only, not active rides. */\n[data-apois-driver-signup-v3], [data-apois-driver-signup-success-v3] { background:#F7F7F8!important;color:#111827!important; color-scheme:light; }\n[data-apois-driver-signup-v3] h1, [data-apois-driver-signup-v3] h2, [data-apois-driver-signup-success-v3] h1, [data-apois-driver-signup-success-v3] h2 { color:#111827!important; }\n[data-apois-driver-signup-v3] input:not([type=\"file\"]), [data-apois-driver-signup-v3] button[role=\"combobox\"] {\n  background:#fff!important; color:#111827!important; -webkit-text-fill-color:#111827!important;\n  border-color:#D9DDE3!important; font-size:16px!important;\n}\n[data-apois-driver-signup-v3] input::placeholder {color:#7A8491!important;-webkit-text-fill-color:#7A8491!important;}\n[data-apois-driver-signup-v3] input:focus-visible, [data-apois-driver-signup-v3] button[role=\"combobox\"]:focus-visible {outline:2px solid #E51B23!important;outline-offset:1px;}\n[data-apois-driver-signup-v3] section [class*=\"text-zinc-\"] {color:#667085!important;}\n[data-apois-driver-signup-success-v3] section {background:#fff!important;border-color:#E5E7EB!important;}\n[data-apois-driver-signup-success-v3] section p {color:#475467!important;}\n";
writeFileSync(cssFile,styles,"utf8");
console.log("[OK] Motorista: todas as etapas permitem sair para o login, tema claro e sessão local isolada.");
