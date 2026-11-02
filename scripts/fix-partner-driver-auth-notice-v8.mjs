import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
// APOIS_DRIVER_AUTH_NOTICE_DEDUP_V8: stale signup banner must never appear
// alongside an authenticated "driver missing" error, or after password recovery.
const f=resolve(".work/partner-motorista/src/routes/motorista.login.tsx");
let src=readFileSync(f,"utf8");
function once(from,to,label){const n=src.split(from).length-1;if(n!==1)throw Error("[FAIL] Driver notice V8 "+label+" anchors="+n);src=src.replace(from,to);}
if(!src.includes("APOIS_DRIVER_EXISTING_PASSENGER_ONBOARD_V7") && !src.includes("data-apois-existing-driver-cta-v7"))throw Error("[FAIL] Existing passenger V7 missing");
if(!src.includes("APOIS_MOTORISTA_PASSWORD_RESULT_V2"))throw Error("[FAIL] Password result V2 missing");
once('{registrationNotice ? <div role="status"',
 '{registrationNotice && !error && !passwordUpdatedNotice ? <div role="status"',
 "mutually exclusive signup/driver-not-found notice");
const fnStart='  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {';
once(fnStart,fnStart+'\n    // APOIS_DRIVER_AUTH_NOTICE_DEDUP_V8: new login attempt invalidates stale signup status.\n    setRegistrationNotice(false);',
 "clear misleading confirmation before login");
if(!src.includes("registrationNotice && !error && !passwordUpdatedNotice"))throw Error("[FAIL] Notice dedup not applied");
writeFileSync(f,src,"utf8");
console.log("[OK] Motorista login never shows stale email-confirmation banner alongside missing-driver warning.");
