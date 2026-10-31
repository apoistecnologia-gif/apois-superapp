import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/entregas");
function patch(path,transform){const file=resolve(root,path),before=readFileSync(file,"utf8"),after=transform(before);if(after===before)throw Error("[FAIL] post-order navigation unchanged: "+path);writeFileSync(file,after,"utf8")}
function replace(s,a,b){if(!s.includes(a))throw Error("[FAIL] navigation source mismatch: "+a.slice(0,75));return s.replace(a,b)}
const KEY="apois_checkout_return_home_after_success_v1";
patch("src/routes/checkout.tsx",s=>{
s=replace(s,'      navigate({ to: "/sacola" });\n      return;','      navigate({ to: "/inicio", replace: true });\n      return;');
s=replace(s,'  const handlePaymentConfirmed = useCallback(() => {\n    clearCart();','  const handlePaymentConfirmed = useCallback(() => {\n    sessionStorage.setItem("'+KEY+'", "1");\n    clearCart();');
return s;
});
patch("src/routes/sacola.tsx",s=>replace(s,
'  useEffect(() => {\n    sessionStorage.setItem("apois_payment_method", "pix");',
'  useEffect(() => {\n    // APOIS_AFTER_ORDER_HOME_V1: never leave customer on an empty bag after confirmed checkout.\n    if (sessionStorage.getItem("'+KEY+'") === "1") {\n      sessionStorage.removeItem("'+KEY+'");\n      if (items.length === 0) { void navigate({ to: "/inicio", replace: true }); return; }\n    }\n    sessionStorage.setItem("apois_payment_method", "pix");'));
console.log("[OK] Client returns to Entregas home after confirmed checkout; ordinary empty bag unaffected.");
