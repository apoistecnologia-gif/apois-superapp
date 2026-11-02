import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
// APOIS_DRIVER_RECOVERY_PENDING_RELAY_V2. Scoped to disposable Motorista QA workspace.
// A prior hardener forwards the recovery link from the partner-shell, but currently
// reads the pending sessionStorage item inside the getLaunchUrl() try block.
// If getLaunchUrl throws, the forwarded callback remains unread.
const file=resolve(".work/partner-motorista/src/lib/auth/driverPasswordRecovery.ts");
let s=readFileSync(file,"utf8");
function once(from,to,label) {
  const n=s.split(from).length-1;
  if(n!==1)throw Error("[FAIL] Motorista recovery V2 "+label+" occurrences="+n);
  s=s.replace(from,to);
}
if(s.includes("APOIS_DRIVER_RECOVERY_PENDING_RELAY_V2"))throw Error("[FAIL] Recovery V2 double application");
if(!s.includes('const PARTNER_FORWARDED_RECOVERY_KEY = "apois-parceiro:motorista-recovery-url";'))
 throw Error("[FAIL] Existing approved shell handoff absent — do not invent another handler");
const oldNested=[
'      try {',
'        const forwardedUrl = window.sessionStorage.getItem(PARTNER_FORWARDED_RECOVERY_KEY);',
'        if (forwardedUrl) {',
'          window.sessionStorage.removeItem(PARTNER_FORWARDED_RECOVERY_KEY);',
'          await handle({ url: forwardedUrl });',
'        }',
'      } catch { /* appUrlOpen/getLaunchUrl continuam ativos */ }',
].join("\n");
once(oldNested,"      // APOIS_DRIVER_RECOVERY_PENDING_RELAY_V2: pending link handled independently below.","remove nested dependency");
const oldCatch=[
'    } catch (error) {',
'      if (import.meta.env.DEV) console.warn("[APOIS Auth] não foi possível ler launch URL", error);',
'    }',
].join("\n");
const newCatch=[
oldCatch,
'    // Always consume the one-time partner-shell handoff, even if native launch',
'    // URL retrieval failed. Erase the callback before decoding or exchanging it.',
'    let forwardedUrl = "";',
'    try {',
'      forwardedUrl = window.sessionStorage.getItem(PARTNER_FORWARDED_RECOVERY_KEY) ?? "";',
'      window.sessionStorage.removeItem(PARTNER_FORWARDED_RECOVERY_KEY);',
'    } catch { /* sessionStorage unavailable; appUrlOpen listener remains active */ }',
'    if (forwardedUrl) await handle({ url: forwardedUrl });',
].join("\n");
once(oldCatch,newCatch,"independent pending consumption");
if(s.indexOf("window.sessionStorage.getItem(PARTNER_FORWARDED_RECOVERY_KEY)") <
   s.indexOf("if (import.meta.env.DEV) console.warn(\"[APOIS Auth] não foi possível ler launch URL\""))
 throw Error("[FAIL] Handoff still nested before native-error boundary");
writeFileSync(file,s,"utf8");
console.log("[OK] Motorista: sessionStorage recovery callback is read independently, consumed once and erased, without duplicating the native listener.");
