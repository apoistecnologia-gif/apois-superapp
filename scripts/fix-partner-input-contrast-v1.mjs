import {existsSync,readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
// APOIS_INPUT_CONTRAST_V1 — modifies only temporary partner build workspaces.
const mode=process.argv[2];
if(!["motorista","entregador"].includes(mode))throw Error("[FAIL] Invalid partner mode");
const base=resolve(".work/partner-"+mode);
const cssPath=resolve(base,mode==="motorista"?"src/styles.css":"src/system-theme.css");
if(!existsSync(cssPath))throw Error("[FAIL] Missing partner theme");
function markForm(file,anchor){
  const p=resolve(base,file);
  if(!existsSync(p))throw Error("[FAIL] Missing form: "+file);
  const old=readFileSync(p,"utf8");
  if(old.includes("data-apois-input-contrast-v1"))return;
  if(old.split(anchor).length!==2)throw Error("[FAIL] Form contract changed: "+file);
  writeFileSync(p,old.replace(anchor,anchor.replace("<form","<form data-apois-input-contrast-v1")),"utf8");
}
if(mode==="motorista"){
  markForm("src/routes/motorista.login.tsx",'<form onSubmit={onSubmit} method="post"');
  markForm("src/routes/motorista.cadastro.tsx",'<form ref={formRef} onSubmit={onSubmit}');
}else{
  markForm("src/routes/register.tsx",'<form onSubmit={handleSubmit} method="post"');
  markForm("src/routes/redefinir-senha.tsx",'<form onSubmit={savePassword} method="post"');
}
const original=readFileSync(cssPath,"utf8");
const marker="/* APOIS_INPUT_CONTRAST_V1 */";
if(!original.includes(marker)){
  const root=mode==="motorista"
    ? ':is([data-apois-input-contrast-v1],[data-apois-partner-auth-v18],[data-apois-driver-recovery-otp-v5])'
    : ':is([data-apois-input-contrast-v1],[data-apois-partner-auth-v17],[data-apois-courier-profile-v1])';
  const fields=root+' :is(input:not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]),textarea,select)';
  const auto=root+" :is(input,textarea):-webkit-autofill";
  const css=[
    "",marker,
    fields+" {background-color:#FFFFFF !important;color:#111827 !important;-webkit-text-fill-color:#111827 !important;caret-color:#C9141B !important;color-scheme:light !important;border-color:#CBD5E1 !important;box-sizing:border-box;min-width:0;max-width:100%;}",
    root+" :is(input,textarea)::placeholder {color:#596372 !important;-webkit-text-fill-color:#596372 !important;opacity:1 !important;}",
    fields+":focus-visible {border-color:#C9141B !important;outline:2px solid #C9141B !important;outline-offset:1px;}",
    auto+","+auto+":hover,"+auto+":focus {-webkit-box-shadow:0 0 0 1000px #FFFFFF inset !important;box-shadow:0 0 0 1000px #FFFFFF inset !important;-webkit-text-fill-color:#111827 !important;caret-color:#C9141B !important;}",
    ...(mode==="motorista" ? [
      "/* APOIS_MOTORISTA_PASSWORD_REVEAL_320_V1: preserve the existing button when the input shrinks at 320px. */",
      ':is([data-apois-input-contrast-v1]) input[name="password"] {width:0 !important;min-width:0 !important;flex:1 1 0% !important;}',
      ':is([data-apois-input-contrast-v1]) button[aria-label="Mostrar senha"],:is([data-apois-input-contrast-v1]) button[aria-label="Ocultar senha"] {display:grid !important;flex:0 0 44px !important;position:relative !important;z-index:2;opacity:1 !important;visibility:visible !important;pointer-events:auto !important;}',
    ]:[]),
    ""
  ].join("\n");
  writeFileSync(cssPath,original+css,"utf8");
}
const final=readFileSync(cssPath,"utf8");
for(const required of [marker,"-webkit-text-fill-color:#111827",":-webkit-autofill","::placeholder",":focus-visible"]){
  if(!final.includes(required))throw Error("[FAIL] Form contrast invariant: "+required);
}
console.log("[OK] "+mode+" forms: white surface, dark typing/caret, safe autofill/focus, bounded widths.");
