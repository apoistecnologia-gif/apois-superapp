import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
// APOIS_DRIVER_RECOVERY_PENDING_RELAY_V2 — use only disposable Motorista workspace.
// The unified Android shell stores a recovery link before navigating to the module.
// The Motorista native handler must consume it exactly once, even if App.getLaunchUrl
// is empty after Android resumed an already-running WebView.
const file=resolve(".work/partner-motorista/src/lib/auth/driverPasswordRecovery.ts");
let s=readFileSync(file,"utf8");
function once(old,newText,label){
 const count=s.split(old).length-1;
 if(count!==1)throw Error("[FAIL] Driver recovery pending relay "+label+" anchors="+count);
 s=s.replace(old,newText);
}
if(s.includes("APOIS_DRIVER_RECOVERY_PENDING_RELAY_V2"))throw Error("[FAIL] Recovery pending relay already applied");
once('const MAX_RECOVERY_URL_LENGTH = 16_384;',
`// APOIS_DRIVER_RECOVERY_PENDING_RELAY_V2: written by partner-shell/index.html
// immediately before /modules/motorista/index.html#/motorista/login.
const PARTNER_PENDING_RECOVERY_KEY = "apois-parceiro:motorista-recovery-url";
const MAX_RECOVERY_URL_LENGTH = 16_384;`,"constant");
once('    try {\n      const launchUrl = await App.getLaunchUrl();\n      if (launchUrl?.url) await handle({ url: launchUrl.url });\n    } catch (error) {\n      if (import.meta.env.DEV) console.warn("[APOIS Auth] não foi possível ler launch URL", error);\n    }',
`    // Attempt the native launch URL first. A resumed app may instead have had
    // its native event consumed by the partner shell before the React module mounts.
    try {
      const launchUrl = await App.getLaunchUrl();
      if (launchUrl?.url) await handle({ url: launchUrl.url });
    } catch (error) {
      if (import.meta.env.DEV) console.warn("[APOIS Auth] não foi possível ler launch URL", error);
    }
    // Consume shell handoff exactly once and erase the sensitive URL immediately.
    // Never log it or move it to localStorage; keep tokens out of persistent storage.
    let pending = "";
    try {
      pending = sessionStorage.getItem(PARTNER_PENDING_RECOVERY_KEY) ?? "";
      sessionStorage.removeItem(PARTNER_PENDING_RECOVERY_KEY);
    } catch { /* storage unavailable */ }
    if (pending) await handle({ url: pending });`,
"pending handoff after listener");
if(!s.includes('sessionStorage.removeItem(PARTNER_PENDING_RECOVERY_KEY)'))throw Error("[FAIL] Pending recovery token not purged");
if(!s.includes('if (pending) await handle({ url: pending })'))throw Error("[FAIL] Shell-to-driver callback not consumed");
writeFileSync(file,s,"utf8");
console.log("[OK] Motorista recovery V2: native callback plus one-time shell handoff; token removed from sessionStorage.");
