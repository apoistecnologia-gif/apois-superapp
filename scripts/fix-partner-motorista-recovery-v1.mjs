import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
// APOIS_MOTORISTA_RECOVERY_HARDEN_V1 — only isolated partner Motorista workspace.
// No changes to auth users, passwords, database, email templates, or Entregador.
const base=resolve(".work/partner-motorista");
function unique(source,old,replacement,label) {
  const count=source.split(old).length-1;
  if(count!==1) throw Error("[FAIL] Motorista recovery "+label+": expected one anchor, found "+count);
  return source.replace(old,replacement);
}
const recoveryFile=resolve(base,"src/routes/motorista.recuperar-senha.tsx");
let recovery=readFileSync(recoveryFile,"utf8");
if(recovery.includes("APOIS_MOTORISTA_RECOVERY_HARDEN_V1"))throw Error("[FAIL] Recovery already patched");
recovery=unique(recovery,
 '<input name="email" type="email" autoComplete="email" inputMode="email" required placeholder="seuemail@exemplo.com"',
 '<input data-apois-driver-recovery-email-v1 name="email" type="email" autoComplete="email" inputMode="email" required placeholder="seuemail@exemplo.com"',
 "email input");
recovery=unique(recovery,
 '<p className="mt-3 break-words text-sm leading-6 text-zinc-500">Se existir uma conta para esse endereço, enviamos um link seguro para criar uma nova senha.</p>',
 '<p className="mt-3 break-words text-sm leading-6 text-[#4B5563]">A solicitação foi recebida. Se o e-mail estiver cadastrado e o servidor permitir o envio, você receberá um link para definir a senha. Esta mensagem não confirma que a senha foi alterada.</p>',
 "successful reset copy");
writeFileSync(recoveryFile,recovery,"utf8");

const cssPath=resolve(base,"src/apois-ui-hardening-round3.css");
let css=readFileSync(cssPath,"utf8");
if(css.includes("APOIS_MOTORISTA_RECOVERY_HARDEN_V1"))throw Error("[FAIL] CSS already patched");
css+=`\n/* APOIS_MOTORISTA_RECOVERY_HARDEN_V1: email on white background must remain readable in Android WebView. */\ninput[data-apois-driver-recovery-email-v1],\ninput[data-apois-driver-recovery-email-v1]:focus,\ninput[data-apois-driver-recovery-email-v1]:-webkit-autofill {\n  color:#111827 !important;\n  -webkit-text-fill-color:#111827 !important;\n  caret-color:#111827 !important;\n}\ninput[data-apois-driver-recovery-email-v1]::placeholder {\n  color:#6B7280 !important;\n  -webkit-text-fill-color:#6B7280 !important;\n  opacity:1;\n}\n`;
writeFileSync(cssPath,css,"utf8");

const rootPath=resolve(base,"src/routes/__root.tsx");
let root=readFileSync(rootPath,"utf8");
// The shell delivers recovery deep links into /motorista/login. A valid recovery
// session must not be redirected to /motorista/app before the reset bridge runs.
root=unique(root,
 'if (pathname !== "/" && pathname !== "/motorista/login") return;',
 'if (pathname !== "/") return; // recovery callback may be pending on /motorista/login',
 "root auth login redirect race");
writeFileSync(rootPath,root,"utf8");

const resetPath=resolve(base,"src/routes/motorista.redefinir-senha.tsx");
let reset=readFileSync(resetPath,"utf8");
reset=unique(reset,
 '      await navigate({ to: "/motorista/app", replace: true });',
 '      // Password updated: return to login. A passenger-only account must not be sent to the driver map.\n      await supabase.auth.signOut();\n      await navigate({ to: "/motorista/login", replace: true });',
 "password update destination");
writeFileSync(resetPath,reset,"utf8");
console.log("[OK] Motorista QA recovery: visible email, honest request status, no auth recovery redirect race, reset returns to login.");
