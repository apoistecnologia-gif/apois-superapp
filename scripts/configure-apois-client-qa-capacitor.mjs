/**
 * Runs only in explicit QA Android CI, BEFORE cap add android.
 * Changes generated shell config for an INSTALLABLE, separate test app.
 * Production br.com.apois.app remains unchanged in Git.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
if (process.env.APOIS_ENTREGAS_CASH_TEST_MODE !== "1" ||
    process.env.APOIS_CLIENT_QA_BUILD !== "1") {
  throw new Error("[FAIL] QA package patch requires BOTH explicit test flags");
}
const path = resolve("superapp/shell/capacitor.config.ts");
let source=readFileSync(path,"utf8");
const oldAppId="appId: 'br.com.apois.app'";
const oldAppName="appName: 'APOIS Cliente'";
const qaAppId="appId: 'br.com.apois.cliente.qa'";
const qaAppName="appName: 'APOIS Cliente TESTE'";
if(!source.includes(oldAppId)||!source.includes(oldAppName)){
  throw new Error("[FAIL] canonical shell package/app name not found");
}
source=source.replace(oldAppId,qaAppId).replace(oldAppName,qaAppName);
writeFileSync(path,source,"utf8");
console.log("[OK] QA shell installable alongside production: br.com.apois.cliente.qa");
