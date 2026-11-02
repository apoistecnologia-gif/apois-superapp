import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
// APOIS_ENTREGAS_LOGIN_CTA_CONTRAST_V1: only mobile login primary CTA colors.
// Preserve Supabase Auth handlers, submission, routes and other product themes.
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const file=resolve(root,"src/routes/login.tsx");
let s=readFileSync(file,"utf8");
const names=["bg-gradient-to-r from-primary to-accent text-base font-black uppercase","bg-gradient-to-r from-primary to-accent text-lg font-black"];
if(s.includes("data-apois-entregas-login-submit-contrast-v1"))throw Error("[FAIL] CTA patch twice");
for(const name of names){
 const matches=s.split(name).length-1;
 if(matches===0 && name.includes("text-lg"))continue; // secondary login may be removed in isolated customer mode
 if(matches!==1)throw Error("[FAIL] Entregas login CTA "+name+" anchors="+matches);
 const anchor='className="h-14 w-full rounded-2xl '+name;
 if(s.split(anchor).length!==2)throw Error("[FAIL] CTA class anchor "+name);
 s=s.replace(anchor,'data-apois-entregas-login-submit-contrast-v1\n                className="h-14 w-full rounded-2xl '+name);
}
writeFileSync(file,s,"utf8");
const cssPath=resolve(root,"src/system-theme.css");
let css=readFileSync(cssPath,"utf8");
if(css.includes("APOIS_ENTREGAS_LOGIN_CTA_CONTRAST_V1"))throw Error("[FAIL] CSS patch twice");
css += "\n/* APOIS_ENTREGAS_LOGIN_CTA_CONTRAST_V1: red button cannot inherit black text */\n" +
 "html.apois-entregas-customer-light-v4 button[data-apois-entregas-login-submit-contrast-v1],\n" +
 "html.apois-entregas-customer-light-v4 [data-apois-entregas-login-submit-contrast-v1] {\n" +
 " color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important;\n}\n";
writeFileSync(cssPath,css,"utf8");
console.log("[OK] Entregas login CTA white text on APOIS red backgrounds; business logic preserved.");
