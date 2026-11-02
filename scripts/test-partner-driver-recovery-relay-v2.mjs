import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {resolve} from "node:path";
import vm from "node:vm";
// APOIS_DRIVER_RECOVERY_RELAY_TEST_V2 — synthetic URL only. Never use a real reset token.
const root=process.cwd();
const shellPath=resolve(root,"superapp/partner-shell/index.html");
const driverPath=resolve(root,".work/partner-motorista/src/lib/auth/driverPasswordRecovery.ts");
const configPath=resolve(root,"scripts/configure-partner-android.mjs");
assert.ok(existsSync(shellPath) && existsSync(driverPath),"Handoff source files missing");
const html=readFileSync(shellPath,"utf8");
const rawScripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const script=rawScripts.find(x=>x.includes("function relayDeepLink(rawUrl)"));
assert.ok(script,"Original Partner shell callback router not found");
const store=new Map();
let redirected="";
const fakeLocation={origin:"https://localhost",assign:url=>{redirected=url},replace:url=>{redirected=url}};
const fakeLocalStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
const fakeSessionStorage={
 getItem:key=>store.get(key)??null,
 setItem:(key,value)=>store.set(key,value),
 removeItem:key=>store.delete(key),
};
const sandbox={window:{location:fakeLocation},document:{querySelectorAll:()=>[]},
  sessionStorage:fakeSessionStorage,localStorage:fakeLocalStorage,
  URL,URLSearchParams,console};
vm.createContext(sandbox);
vm.runInContext(script,sandbox,{timeout:2000});
const testLink="apoismotorista://auth/redefinir-senha?code=synthetic_code_no_real_credentials&type=recovery";
assert.equal(vm.runInContext("relayDeepLink("+JSON.stringify(testLink)+")",sandbox,{timeout:1500}),true);
assert.equal(store.get("apois-parceiro:motorista-recovery-url"),testLink);
assert.match(redirected,/\/modules\/motorista\/index\.html#\/motorista\/login$/);
assert.equal(vm.runInContext('relayDeepLink("https://unrelated.invalid/")',sandbox,{timeout:1500}),false);
assert.equal(store.get("apois-parceiro:motorista-recovery-url"),testLink);
const driver=readFileSync(driverPath,"utf8");
assert.ok(driver.includes("APOIS_DRIVER_RECOVERY_PENDING_RELAY_V2"),"Motorista V2 callback handler missing");
assert.ok(driver.includes("apois-parceiro:motorista-recovery-url") && driver.includes("PARTNER_FORWARDED_RECOVERY_KEY"),"Partner-shell storage key differs");
assert.ok(driver.includes("forwardedUrl = window.sessionStorage.getItem(PARTNER_FORWARDED_RECOVERY_KEY)"),"Pending callback never read");
assert.ok(driver.includes("window.sessionStorage.removeItem(PARTNER_FORWARDED_RECOVERY_KEY)"),"Pending recovery URL not erased");
assert.ok(driver.includes("if (forwardedUrl) await handle({ url: forwardedUrl })"),"Pending callback not consumed");
assert.ok(driver.indexOf('window.sessionStorage.getItem(PARTNER_FORWARDED_RECOVERY_KEY)') > driver.indexOf('await App.getLaunchUrl()'),"Native callback ordering wrong");
assert.ok(driver.indexOf('window.sessionStorage.getItem(PARTNER_FORWARDED_RECOVERY_KEY)') > driver.indexOf('não foi possível ler launch URL'),"Forwarded callback must be read after native launch error is handled");
assert.ok(readFileSync(configPath,"utf8").includes('android:scheme="apoismotorista"'),"Native recovery scheme not declared");
const dist=resolve(root,"superapp/partner-shell/dist/modules/motorista");
if(existsSync(dist)){
 const {readdirSync}=await import("node:fs");
 const {join}=await import("node:path");
 const walk=(path)=>readdirSync(path,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(join(path,d.name)):[join(path,d.name)]);
 const js=walk(dist).filter(p=>p.endsWith(".js"));
 assert.ok(js.length,"Motorista bundle missing");
 assert.ok(js.some(p=>readFileSync(p,"utf8").includes("apois-parceiro:motorista-recovery-url")),"Recovery handoff not bundled");
}
// Guard the previously regressed white-on-white recovery input, including Android autofill.
const recoveryForm = readFileSync(resolve(root,".work/partner-motorista/src/routes/motorista.recuperar-senha.tsx"),"utf8");
const recoveryCss = readFileSync(resolve(root,".work/partner-motorista/src/apois-ui-hardening-round3.css"),"utf8");
const recoveryReset = readFileSync(resolve(root,".work/partner-motorista/src/routes/motorista.redefinir-senha.tsx"),"utf8");
assert.ok(recoveryForm.includes("data-apois-driver-recovery-email-v1") && recoveryForm.includes('WebkitTextFillColor:"#111827"'),
  "Recovery email input must explicitly force dark typed text in Android WebView");
assert.match(recoveryForm,/colorScheme: "light"/,"Recovery input must not inherit Android dark input autofill theme");
assert.ok(recoveryCss.includes("APOIS_DRIVER_RECOVERY_INLINE_CONTRAST_V3"),"Native autofill CSS safety rule absent");
assert.ok(recoveryCss.includes("-webkit-autofill:focus"),"Autofill contrast missing focus selector");
assert.ok(recoveryReset.includes('to: "/motorista/login", replace: true'),"Reset success must return to login");
console.log("[OK] Motorista recovery email input: typed, auto-filled, focused text contrast and safe post-reset login present.");
// Reuse the OTP verification contract already introduced in APOIS Estabelecimento.
assert.ok(recoveryForm.includes("APOIS_DRIVER_RECOVERY_EMAIL_OTP_V5"),"Motorista must use OTP recovery");
assert.ok(recoveryForm.includes('supabase.auth.verifyOtp({'),"OTP verification must use Supabase Auth");
assert.ok(recoveryForm.includes('type: "recovery"'),"OTP type must be recovery");
assert.ok(recoveryForm.includes('token: sanitizedCode'),"Numeric user code must be verified");
assert.ok(recoveryForm.includes('email: parsed.data.email.trim().toLowerCase()'),"OTP must be bound to the provided email");
assert.ok(recoveryForm.includes('to: "/motorista/redefinir-senha", replace: true'),"OTP must navigate only on verified session");
assert.ok(recoveryForm.includes('data-apois-driver-recovery-otp-input-v5'),"Numeric OTP form must be rendered");
assert.ok(recoveryForm.includes('autoComplete="one-time-code"'),"Android numeric OTP autofill must be available");
assert.ok(!recoveryForm.includes("data-apois-driver-recovery-paste-v4"),"Unsafe legacy copy-link option must be removed from Motorista");
assert.ok(!recoveryForm.includes("setRecoveryLink"),"Recovery links must not be retained in state");
console.log("[OK] Motorista recovery OTP: email+numeric token+recovery session; no manual link parsing.");

console.log("[OK] Partner shell stores one synthetic recovery callback and navigates to Motorista; module reads, consumes and deletes pending link; native scheme registered.");
