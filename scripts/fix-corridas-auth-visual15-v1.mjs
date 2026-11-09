// APOIS RV-15 — presentation-only recovery/reset overlays in disposable Corridas.
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
export const MARK="APOIS_CV15_AUTH_FEEDBACK_ACCESSIBILITY_V1";
const TEMPLATE="scripts/templates/apoisPassengerPublicAuthError.ts";

function once(source,before,after,label) {
  const hits=source.split(before).length-1;
  if(hits!==1)throw Error("[RV15] "+label+" anchor count="+hits);
  return source.replace(before,after);
}
function completed(src,needed,label) {
  for(const token of needed)if(!src.includes(token))throw Error("[RV15] incomplete "+label+": "+token);
  return src;
}
export function patchRecover(src) {
  const required=[MARK,"passengerPublicAuthError(error, \"recover\")",'htmlFor="apois-recover-email"',
    'id="apois-recover-email"',"autoComplete=\"email\"",
    'Capacitor.isNativePlatform()',"br.com.apois.app://auth/corridas-reset"];
  if(src.includes(MARK))return completed(src,required,"recover");
  completed(src,['Capacitor.isNativePlatform()','br.com.apois.app://auth/corridas-reset',
    "resetPasswordForEmail(email.trim().toLowerCase()","setSent(true)","toast.success(","toast.error(error.message)"],"recover base");
  let out=once(src,'import { toast } from "sonner";',
    'import { toast } from "sonner";\nimport { passengerPublicAuthError } from "@/lib/apoisPassengerPublicAuthError"; // '+MARK,
    "recovery import");
  out=once(out,"        toast.error(error.message);",
    '        console.error("[APOIS Passageiro] Falha na solicitação de recuperação", error);\n        toast.error(passengerPublicAuthError(error, "recover"));',
    "recover provider error");
  out=once(out,'    } catch (err) {\n      toast.error("Erro ao solicitar recuperação de senha.");',
    '    } catch (err) {\n      console.error("[APOIS Passageiro] Falha inesperada na recuperação", err);\n      toast.error(passengerPublicAuthError(err, "recover"));',
    "recover unexpected error");
  out=once(out,'<label className="text-sm font-medium text-gray-300">E-mail</label>',
    '<label htmlFor="apois-recover-email" className="text-sm font-medium text-gray-300">E-mail</label>',
    "recovery label");
  out=once(out,'                type="email"\n                placeholder="seu@email.com"',
    '                id="apois-recover-email"\n                type="email"\n                autoComplete="email"\n                placeholder="seu@email.com"',
    "recovery input");
  return completed(out,required,"recover patched");
}
export function patchReset(src) {
  const required=[MARK,'passengerPublicAuthError(error, "reset")','id="apois-reset-password"',
    'id="apois-reset-confirm-password"','htmlFor="apois-reset-password"',
    'htmlFor="apois-reset-confirm-password"','aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}',
    'min-h-11 min-w-11','exchangeCodeForSession(code)','supabase.auth.setSession',
    'if (password.length < 6)'];
  if(src.includes(MARK))return completed(src,required,"reset");
  completed(src,['exchangeCodeForSession(code)','supabase.auth.setSession',
    'if (password.length < 6)','toast.error(error.message);',
    'setIsValidSession(true)',"supabase.auth.updateUser({"],"reset base");
  let out=once(src,'import { toast } from "sonner";',
    'import { toast } from "sonner";\nimport { passengerPublicAuthError } from "@/lib/apoisPassengerPublicAuthError"; // '+MARK,
    "reset import");
  out=once(out,"        toast.error(error.message);",
    '        console.error("[APOIS Passageiro] Falha ao redefinir a senha", error);\n        toast.error(passengerPublicAuthError(error, "reset"));',
    "reset provider error");
  out=once(out,'    } catch (err) {\n      toast.error("Erro ao redefinir senha.");',
    '    } catch (err) {\n      console.error("[APOIS Passageiro] Falha inesperada na redefinição", err);\n      toast.error(passengerPublicAuthError(err, "reset"));',
    "reset unexpected error");
  out=once(out,'<label className="text-sm font-medium text-gray-300">Nova senha</label>',
    '<label htmlFor="apois-reset-password" className="text-sm font-medium text-gray-300">Nova senha</label>',
    "reset password label");
  out=once(out,'<label className="text-sm font-medium text-gray-300">Confirmar nova senha</label>',
    '<label htmlFor="apois-reset-confirm-password" className="text-sm font-medium text-gray-300">Confirmar nova senha</label>',
    "reset confirmation label");
  out=once(out,'              type={showPassword ? "text" : "password"}\n              placeholder="Digite a nova senha"',
    '              id="apois-reset-password"\n              type={showPassword ? "text" : "password"}\n              autoComplete="new-password"\n              placeholder="Digite a nova senha"',
    "reset password input");
  out=once(out,'              type="password"\n              placeholder="Repita a nova senha"',
    '              id="apois-reset-confirm-password"\n              type="password"\n              autoComplete="new-password"\n              placeholder="Repita a nova senha"',
    "reset confirmation input");
  out=once(out,'              onClick={() => setShowPassword(!showPassword)}\n              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"',
    '              onClick={() => setShowPassword(!showPassword)}\n'+
    '              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}\n'+
    '              aria-pressed={showPassword}\n'+
    '              aria-controls="apois-reset-password"\n'+
    '              className="absolute right-1 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E51B23]"',
    "reveal target and accessible name");
  return completed(out,required,"reset patched");
}
export function applyVisual15Auth(root=process.cwd()){
  const work=resolve(root,".work/corridas");
  const plans=[
    ["src/routes/_public.recuperar-senha.tsx",patchRecover],
    ["src/routes/_public.redefinir-senha.tsx",patchReset],
  ].map(([rel,fn])=>{
    const path=resolve(work,rel),before=readFileSync(path,"utf8"),after=fn(before);
    if(fn(after)!==after)throw Error("[RV15] non-idempotent "+rel);
    return {rel,path,before,after};
  });
  const template=readFileSync(resolve(root,TEMPLATE),"utf8");
  if(!template.includes('passengerPublicAuthError'))throw Error("[RV15] helper missing");
  const helper=resolve(work,"src/lib/apoisPassengerPublicAuthError.ts");
  // Validate both source transforms before changing any file on disk.
  mkdirSync(dirname(helper),{recursive:true});
  if(readOptional(helper)!==template)writeFileSync(helper,template,"utf8");
  for(const plan of plans)if(plan.before!==plan.after)writeFileSync(plan.path,plan.after,"utf8");
  return plans.map(p=>({file:p.rel,changed:p.before!==p.after}));
}
function readOptional(path){try{return readFileSync(path,"utf8")}catch(e){if(e?.code==="ENOENT")return null;throw e}}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  console.log("[OK] RV15 Passenger auth presentation",JSON.stringify(applyVisual15Auth()));
}
