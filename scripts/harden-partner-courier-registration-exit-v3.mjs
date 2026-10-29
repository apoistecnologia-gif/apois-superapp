import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
const routeFile=resolve(root,"src/routes/courier.tsx"),viewFile=resolve(root,"src/components/CourierPremiumViews.tsx"),cssFile=resolve(root,"src/system-theme.css");
const must=(x,msg)=>{if(!x)throw Error("[FAIL] Entregador cadastro V3: "+msg);};
function replaceOnce(s,a,b,label){const n=s.split(a).length-1;must(n===1,label+" matches="+n);return s.replace(a,b);}
let route=readFileSync(routeFile,"utf8");
must(!route.includes("APOIS_COURIER_REGISTRATION_EXIT_V3"),"duplicate patch");
const submit="  const submitApplication = async (event: React.FormEvent<HTMLFormElement>) => {";
route=replaceOnce(route,submit,"  // APOIS_COURIER_REGISTRATION_EXIT_V3: local-only logout for incomplete registration.\n  const leaveIncompleteRegistration = async () => {\n    if (busy === \"application\" || busy === \"registration-exit\") return;\n    setBusy(\"registration-exit\");\n    try {\n      const configuredUrl = String(import.meta.env.VITE_SUPABASE_URL ?? \"\");\n      const projectRef = new URL(configuredUrl).hostname.split(\".\")[0];\n      if (projectRef !== \"ptgkwyyolrdgnqketkjj\") throw new Error(\"Configuração de autenticação do Entregador inesperada.\");\n      try {\n        await Promise.race([\n          supabase.auth.signOut({ scope: \"local\" }),\n          new Promise((_, reject) => window.setTimeout(() => reject(new Error(\"local_signout_timeout\")), 4000)),\n        ]);\n      } catch (error) {\n        // Never clear another product's session, even if Auth is offline.\n        console.warn(\"[APOIS COURIER] fallback para logout local\", error);\n      }\n      const tokenKey = \"sb-\" + projectRef + \"-auth-token\";\n      window.localStorage.removeItem(tokenKey);\n      if (window.localStorage.getItem(tokenKey) !== null) throw new Error(\"Não foi possível encerrar a sessão neste dispositivo.\");\n      try { window.localStorage.removeItem(\"apois-parceiro:operational-role\"); } catch {}\n      // Courier is a hash-history module, not the outer partner selector.\n      window.location.replace(window.location.pathname + window.location.search + \"#/login\");\n    } catch (error) {\n      toast.error(error instanceof Error ? error.message : \"Não foi possível voltar ao login.\");\n    } finally {\n      setBusy((current) => current === \"registration-exit\" ? null : current);\n    }\n  };\n\n"+submit,"insert authenticated exit");
const a=route.indexOf("      <CourierApplication"),b=route.indexOf("      />",a);
must(a>=0&&b>a,"render CourierApplication");let call=route.slice(a,b);
must(/onBack=\{[^\n]+\}/.test(call),"registration back callback");
call=call.replace(/onBack=\{[^\n]+\}/,'onBack={() => void leaveIncompleteRegistration()}');
call=call.replace('busy={busy === "application"}','busy={busy === "application" || busy === "registration-exit"}');
must(call.includes("leaveIncompleteRegistration()"),"registration exit wired");
route=route.slice(0,a)+call+route.slice(b);
const bs=route.indexOf('App.addListener("backButton", () => {'),be=route.indexOf('void backHandle?.remove()',bs);
must(bs>=0&&be>bs,"Android back handler");let back=route.slice(bs,be);
back=replaceOnce(back,'      if (supportOpen) {','      if (!courier) { void leaveIncompleteRegistration(); return; }\n      if (supportOpen) {',"Android back from incomplete registration");
route=route.slice(0,bs)+back+route.slice(be);
route=replaceOnce(route,
 '}, [activeJob, availability?.is_online, busy, completedJob, financeOpen, historyOpen, profileOpen, supportOpen]);',
 '}, [activeJob, availability?.is_online, busy, completedJob, courier?.id, financeOpen, historyOpen, profileOpen, supportOpen]);',
 "Android back dependency");
writeFileSync(routeFile,route,"utf8");

let source=readFileSync(viewFile,"utf8");
const start=source.indexOf("export function CourierApplication("),end=source.indexOf("export function CourierReviewState(",start);
must(start>=0&&end>start,"registration component section");
let app=source.slice(start,end);
const resume=app.indexOf("  // APOIS_COURIER_INCOMPLETE_RESUME_V1");
if(resume>=0){const to=app.indexOf("\n  return (",resume);must(to>resume,"old forced resume effect");app=app.slice(0,resume)+app.slice(to);}
app=replaceOnce(app,
 '<div className="min-h-dvh bg-[#F7F7F8] text-[#111827]">',
 '<div data-apois-courier-application-v3 className="min-h-dvh bg-[#F7F7F8] text-[#111827]">',
 "main theme scope");
app=replaceOnce(app,"onClick={onBack}","onClick={onBack}\n          disabled={busy}\n          aria-label=\"Sair do cadastro e voltar ao login\"","back control");
app=replaceOnce(app,"← Voltar","← Sair do cadastro","back control label");
const hero=/<section className="relative overflow-hidden rounded-\[2rem\][^"]*">/;
must(hero.test(app),"dark hero");app=app.replace(hero,
 '<section data-apois-courier-register-hero-v3 className="relative overflow-hidden rounded-[28px] border border-[#F2D3D6] bg-white p-5 text-[#111827] shadow-[0_16px_38px_-28px_rgba(17,24,39,.25)]">');
app=replaceOnce(app,'<h1 className="mt-4 text-3xl font-black leading-tight">',
 '<h1 className="mt-4 text-3xl font-black leading-tight text-[#111827]">',"readable hero title");
const form=/<form\s+onSubmit=\{onSubmit\}\s+className="[^"]*"/;
must(form.test(app),"application form");
app=app.replace(form,'<form onSubmit={onSubmit} data-apois-courier-register-form-v3 className="mt-4 space-y-3 rounded-[28px] border border-[#E5E7EB] bg-white p-4 text-[#111827] shadow-sm"');
const last=app.lastIndexOf("</form>");must(last>0,"application form ending");
app=app.slice(0,last)+"          <button type=\"button\" disabled={busy} aria-label=\"Sair do cadastro e voltar ao login\"\n            onClick={onBack}\n            className=\"mt-3 flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#E5E7EB] bg-white px-4 text-sm font-bold text-[#B91C1C] disabled:opacity-50\">\n            Sair do cadastro e voltar ao login\n          </button>\n        "+app.slice(last);
source=source.slice(0,start)+app+source.slice(end);
// The old automatic resume redirect was removed: its dedicated imports must
// also be removed or TypeScript noUnusedLocals will reject the next build.
for (const unused of [
  'import { App as CourierAppLifecycle } from "@capacitor/app";\\n',
  'import { Capacitor as CourierCapacitor } from "@capacitor/core";\\n',
]) {
  const literal = unused.replace(/\\n/g,"\n");
  if (!source.includes(literal)) throw Error("[FAIL] unused resume import missing: "+unused);
  source=source.replace(literal,"");
}
writeFileSync(viewFile,source,"utf8");
let theme=readFileSync(cssFile,"utf8");
must(!theme.includes("APOIS_COURIER_REGISTRATION_CONTRAST_V3"),"duplicate CSS");
theme+="\n/* APOIS_COURIER_REGISTRATION_CONTRAST_V3: isolated incomplete courier form. */\n[data-apois-courier-application-v3] { background:#F7F7F8!important; color:#111827!important; color-scheme:light; }\n[data-apois-courier-register-hero-v3] { background:#fff!important; color:#111827!important; border-color:#F2D3D6!important; }\n[data-apois-courier-register-hero-v3] h1 { color:#111827!important; }\n[data-apois-courier-register-hero-v3] h1 span { color:#E51B23!important; }\n[data-apois-courier-register-hero-v3] p { color:#596372!important; }\n[data-apois-courier-register-form-v3] { background:#fff!important; color:#111827!important; border-color:#E5E7EB!important; }\n[data-apois-courier-register-form-v3] input, [data-apois-courier-register-form-v3] select {\n  background-color:#fff!important; color:#111827!important;\n  -webkit-text-fill-color:#111827!important;\n  border:1px solid #D9DDE3!important; border-radius:16px!important; font-size:16px!important;\n}\n[data-apois-courier-register-form-v3] input::placeholder {\n  color:#7A8491!important; -webkit-text-fill-color:#7A8491!important;\n}\n[data-apois-courier-register-form-v3] input:focus, [data-apois-courier-register-form-v3] select:focus {\n  outline:2px solid #E51B23!important; outline-offset:1px;\n}\n[data-apois-courier-register-form-v3] input[aria-invalid=\"true\"] { border-color:#E51B23!important; }\n[data-apois-courier-register-form-v3] p { color:#596372!important; }\n[data-apois-courier-register-form-v3] button[type=\"submit\"] { background:#E51B23!important; color:#fff!important; }\n";
writeFileSync(cssFile,theme,"utf8");
console.log("[OK] Entregador: sair do cadastro volta ao login, token local removido, back Android seguro, formulário branco.");
