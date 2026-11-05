// Separate QA package: do not alter the original installed br.com.apois.app.
// Script runs only in temporary GitHub Actions checkout for an isolated build.
import { readFileSync, writeFileSync } from "node:fs";
const path = "superapp/shell/capacitor.config.ts";
let source = readFileSync(path,"utf8");
for(const [before,after] of [
 ["appId: 'br.com.apois.app'","appId: 'br.com.apois.app.homolog'"],
 ["appName: 'APOIS Cliente'","appName: 'APOIS Cliente QA'"],
]) {
 if(source.split(before).length !== 2)throw Error("[FAIL] QA client capacitor original anchor mismatch: "+before);
 source = source.replace(before,after);
}
writeFileSync(path,source,"utf8");
console.log("[OK] Parallel Client QA Android package configured; original source and installed APK intact.");
