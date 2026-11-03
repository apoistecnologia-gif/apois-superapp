// APOIS_CORRIDAS_PUBLIC_FORM_CONTRAST_V1 — scoped strictly to public signup/recovery forms.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.env.APOIS_CORRIDAS_WORKSPACE||'.work/corridas');
const marker='data-apois-corridas-public-form-contrast-v1';
for (const rel of [
 'src/routes/_public.cadastro.tsx',
 'src/routes/_public.recuperar-senha.tsx',
 'src/routes/_public.redefinir-senha.tsx',
]) {
 const path=resolve(root,rel),old=readFileSync(path,'utf8');
 if(old.includes(marker))continue;
 if((old.match(/<form\\s/g)||[]).length!==1)throw Error('[FAIL] Public form anchor drift: '+rel);
 const patched=old.replace(/<form(?=\\s)/,'<form '+marker);
 if(patched===old||!patched.includes('<form '+marker))throw Error('[FAIL] Public form not marked: '+rel);
 writeFileSync(path,patched,'utf8');
}
const cssPath=resolve(root,'src/styles.css');
const css=readFileSync(cssPath,'utf8');
const styleMarker='/* APOIS_CORRIDAS_PUBLIC_FORM_CONTRAST_V1 */';
const rules=[
 styleMarker,
 '[data-apois-corridas-public-form-contrast-v1] :is(input:not([type="checkbox"]):not([type="radio"]),textarea)::placeholder {color:#596372 !important;opacity:1 !important;-webkit-text-fill-color:#596372 !important;}',
].join('\\n');
if(!css.includes(styleMarker))writeFileSync(cssPath,css+'\\n'+rules+'\\n','utf8');
if(!readFileSync(cssPath,'utf8').includes(styleMarker))throw Error('[FAIL] Public CSS missing');
console.log('[OK] Corridas signup/recovery placeholders are dark in public forms only, preserving authenticated screens and logic.');
