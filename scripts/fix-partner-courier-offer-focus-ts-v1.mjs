// Strict TS safety on the disposable Entregador offer focus trap only.
// Don't change offer RPCs, timers, eligibility or transitions.
import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
// Partner build invokes this after cd .work/partner-entregador; never nest .work twice.
const cwd=process.cwd();
// The builder exports a *relative* APOIS_ENTREGAS_WORKSPACE before cd into it.
// Prefer the existing generated module in cwd; never resolve the env path twice.
const relative="src/components/CourierOfferOverlay.tsx";
const workInCwd=resolve(cwd,relative);
const workspace=existsSync(workInCwd) && cwd.endsWith("/.work/partner-entregador")
  ? cwd : resolve(cwd,process.env.APOIS_ENTREGAS_WORKSPACE||".work/partner-entregador");
if(!workspace.includes("/.work/partner-entregador"))throw Error("[FAIL] courier workspace outside disposable build");
const path=resolve(workspace,relative);
const marker="APOIS_COURIER_OFFER_FOCUS_OPTIONAL_V1";
const s=readFileSync(path,"utf8");
if(s.includes(marker)){console.log("[OK] Courier focus TS guard already installed");process.exit(0);}
let next=s;
const first=(s.match(/\bfirst\.focus\(/g)||[]).length;
const last=(s.match(/\blast\.focus\(/g)||[]).length;
if(!first||!last||first>5||last>5)throw Error("[FAIL] Courier focus trap anchors changed: "+first+"/"+last);
next=next.replaceAll("first.focus(","first?.focus(").replaceAll("last.focus(","last?.focus(");
if(next===s||!next.includes("role=\"dialog\""))throw Error("[FAIL] Courier offer focus protection not verified");
writeFileSync(path,"// "+marker+"\n"+next,"utf8");
console.log("[OK] Courier offer: optional focus avoids undefined target; offer RPC and timer unchanged");
