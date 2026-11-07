// APOIS_ENTREGAS_CUSTOMER_ADDRESS_VISUAL_V8
// Ajuste EXCLUSIVAMENTE visual. Fontes protegidas, outras verticais, Supabase,
// GPS, busca, CEP e persistencia nao sao modificados.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
const formPath = resolve(root, "src/routes/enderecos/novo.tsx");
const selectorPath = resolve(root, "src/components/CustomerLocationAddressSelector.tsx");
const cssPath = resolve(root, "src/system-theme.css");

function one(source, before, after, label) {
  if (source.includes(after)) return source;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error("[FAIL] Endereco visual V8: " + label + " (" + count + ")");
  return source.replace(before, after);
}

let form = readFileSync(formPath, "utf8");
form = one(form,
  '<div className="absolute inset-0 z-[160] flex w-full flex-col overflow-x-hidden overflow-y-auto bg-black text-white">',
  '<div data-apois-address-create-v8="true" className="fixed inset-0 z-[160] flex w-full flex-col overflow-hidden bg-[#F7F7F8] text-[#171D27]">',
  "viewport do cadastro");
form = one(form,
  '<header className="sticky top-0 z-50 flex items-center border-b border-white/10 bg-black/90 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-xl">',
  '<header data-apois-address-header-v8="true" className="relative z-20 flex shrink-0 items-center border-b border-[#EAECF0] bg-white px-4 pb-3 pt-[max(env(safe-area-inset-top),1rem)]">',
  "cabecalho");
form = one(form,
  '<main className="flex-1 overflow-y-auto pb-36">',
  '<main data-apois-address-main-v8="true" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">',
  "rolagem independente do teclado");
form = one(form,
  '<div className="border-b border-white/5 bg-gradient-to-b from-zinc-950 to-black px-5 py-5">',
  '<div data-apois-address-locate-v8="true" className="border-b border-[#EFF0F3] bg-white px-4 pb-4 pt-4">',
  "painel de localizacao");
form = one(form,
  '<form onSubmit={handleSubmit} method="post" className="space-y-5 px-5 py-5">',
  '<form data-apois-address-fields-v8="true" onSubmit={handleSubmit} method="post" className="space-y-4 px-4 py-4">',
  "campos do formulario");

// Distingue os grids sem alterar sua ordem, suas propriedades ou validacoes.
form = one(form,
  '<div className="grid grid-cols-3 gap-3">\n            <Field label="CEP*"',
  '<div data-apois-address-cep-row-v8="true" className="grid grid-cols-3 gap-3">\n            <Field label="CEP*"',
  "CEP e rua");
form = one(form,
  '<div className="grid grid-cols-3 gap-3">\n            <Field label="Número*"',
  '<div data-apois-address-number-row-v8="true" className="grid grid-cols-3 gap-3">\n            <Field label="Número*"',
  "numero e complemento");
form = one(form,
  '<div className="grid grid-cols-4 gap-3">',
  '<div data-apois-address-city-row-v8="true" className="grid grid-cols-4 gap-3">',
  "cidade e UF");
form = one(form,
  '<div className="sticky bottom-0 z-50 bg-gradient-to-t from-black via-black to-transparent px-5 pt-8 pb-[max(env(safe-area-inset-bottom),2.75rem)]">',
  '<div data-apois-address-footer-v8="true" className="relative z-30 shrink-0 border-t border-[#ECEEF2] bg-white px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">',
  "acao fixa sem gradiente sobre campos");
writeFileSync(formPath, form, "utf8");

let selector = readFileSync(selectorPath, "utf8");
selector = one(selector,
  '<div className="space-y-3">\n      <Button',
  '<div data-apois-address-selector-v8="true" className="space-y-3">\n      <Button',
  "busca e botao GPS");
writeFileSync(selectorPath, selector, "utf8");

let css = readFileSync(cssPath, "utf8");
const marker = "/* APOIS_ENTREGAS_CUSTOMER_ADDRESS_VISUAL_V8 */";
if (!css.includes(marker)) {
  css += "\n\n" + [
    marker,
    "/* Somente /enderecos/novo dentro do Cliente Entregas; sem efeito em courier, merchant ou admin. */",
    "html.apois-entregas-customer-light-v4 [data-apois-address-create-v8]{position:fixed!important;inset:0!important;height:100dvh!important;min-height:0!important;background:#F7F7F8!important;color:#171D27!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-header-v8]{background:#fff!important;box-shadow:0 3px 16px rgba(17,24,39,.04);min-height:63px!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-header-v8] h1{color:#171D27!important;font-size:18px!important;font-weight:800!important;letter-spacing:-.025em;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-header-v8] button{color:#E51B23!important;background:#F8F9FB!important;border:1px solid #ECEEF2!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-main-v8]{flex:1 1 0%!important;min-height:0!important;overflow-y:auto!important;overscroll-behavior:contain;scroll-padding-bottom:26px;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-locate-v8]{padding:14px 16px 16px!important;background:#fff!important;border-color:#ECEEF2!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-locate-v8] > div:first-child{margin-bottom:12px!important;padding:11px 12px!important;border-radius:13px!important;gap:9px!important;background:#FFF8EF!important;border-color:#F3E1C5!important;color:#8F451B!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-locate-v8] > div:first-child[class*='emerald']{background:#ECFDF3!important;border-color:#C3EAD4!important;color:#166534!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-locate-v8] > div:first-child p:first-child{font-size:12px!important;line-height:17px!important;letter-spacing:0!important;font-weight:800!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-locate-v8] > div:first-child p:last-child{font-size:11px!important;line-height:16px!important;margin-top:3px!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-selector-v8] > button:first-child{width:100%!important;height:48px!important;min-height:48px!important;border-radius:13px!important;background:#E51B23!important;color:#fff!important;font-size:14px!important;font-weight:750!important;box-shadow:0 7px 18px rgba(229,27,35,.15)!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-selector-v8] > button:first-child svg{color:#fff!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-selector-v8] > .relative > input{width:100%;height:46px!important;background:#F8FAFC!important;border:1px solid #E4E7EC!important;border-radius:13px!important;color:#171D27!important;padding-left:42px!important;font-size:14px!important;box-shadow:none!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-selector-v8] > .relative > div[class*='absolute']{background:#fff!important;color:#171D27!important;border-color:#E4E7EC!important;border-radius:13px!important;box-shadow:0 12px 32px rgba(17,24,39,.12)!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-selector-v8] > .relative > div[class*='absolute'] button{color:#171D27!important;border-color:#E4E7EC!important;text-align:left;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-selector-v8] > p{font-size:11px!important;line-height:16px!important;color:#667085!important;margin-top:5px!important;padding:0 2px!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-fields-v8]{background:#fff!important;margin:12px 12px 18px!important;padding:16px 14px!important;border:1px solid #E9ECF1!important;border-radius:20px!important;box-shadow:0 5px 20px rgba(21,30,45,.045)!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-fields-v8] label{color:#465267!important;font-size:12px!important;font-weight:700!important;letter-spacing:0!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-fields-v8] > div:first-child > label{display:block;font-size:10px!important;letter-spacing:.08em!important;color:#667085!important;margin-bottom:8px!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-fields-v8] > div:first-child > div{gap:8px!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-fields-v8] > div:first-child > div > button{height:62px!important;min-height:62px!important;padding:8px 4px!important;border-radius:13px!important;border:1px solid #E6E9EF!important;background:#F8FAFC!important;color:#485366!important;font-size:12px!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-fields-v8] > div:first-child > div > button[class*='bg-primary']{background:#E51B23!important;border-color:#E51B23!important;color:#fff!important;box-shadow:0 5px 12px rgba(229,27,35,.14)!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-fields-v8] input{height:46px!important;min-width:0!important;width:100%!important;border:1px solid #E2E6EB!important;border-radius:12px!important;background:#FAFBFC!important;color:#171D27!important;font-size:14px!important;padding:0 12px!important;box-shadow:none!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-fields-v8] input:focus{outline:0!important;border-color:#E51B23!important;box-shadow:0 0 0 3px rgba(229,27,35,.09)!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-cep-row-v8]{display:grid!important;grid-template-columns:minmax(0,1fr) 126px!important;align-items:end!important;gap:10px!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-cep-row-v8] > div[class*='col-span-2']{grid-column:1/-1!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-cep-row-v8] > button{height:46px!important;min-height:46px!important;width:126px!important;white-space:nowrap!important;padding:0 7px!important;font-size:12px!important;font-weight:700!important;line-height:1.2!important;border:1px solid #F4C5C8!important;border-radius:12px!important;background:#FFF1F2!important;color:#AD1019!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-number-row-v8]{display:grid!important;grid-template-columns:minmax(105px,.75fr) minmax(0,1.25fr)!important;gap:10px!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-number-row-v8] > div[class*='col-span-2']{grid-column:auto!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-city-row-v8]{display:grid!important;grid-template-columns:minmax(0,1fr) 84px!important;gap:10px!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-city-row-v8] > div[class*='col-span-3']{grid-column:auto!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-footer-v8]{padding:12px 16px max(14px,env(safe-area-inset-bottom))!important;border-top:1px solid #ECEEF2!important;background:#fff!important;background-image:none!important;box-shadow:0 -5px 16px rgba(17,24,39,.045)!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-footer-v8] button{width:100%!important;height:50px!important;min-height:50px!important;border-radius:13px!important;background:#E51B23!important;color:#fff!important;font-size:15px!important;font-weight:800!important;box-shadow:0 6px 18px rgba(229,27,35,.14)!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-footer-v8] button svg{color:#fff!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-footer-v8] button:disabled{opacity:.55!important;box-shadow:none!important;}",
    "html.apois-entregas-customer-light-v4 [data-apois-address-create-v8]:has(input:focus) [data-apois-address-footer-v8]{display:none!important;}",
    "@media(max-width:360px){html.apois-entregas-customer-light-v4 [data-apois-address-cep-row-v8]{grid-template-columns:minmax(0,1fr) 113px!important;}html.apois-entregas-customer-light-v4 [data-apois-address-cep-row-v8] > button{width:113px!important;font-size:11px!important;}}",
  ].join("\n") + "\n";
  writeFileSync(cssPath, css, "utf8");
}

for (const [label, source, tokens] of [
  ["form", form, ["data-apois-address-create-v8", "data-apois-address-header-v8", "data-apois-address-main-v8", "data-apois-address-locate-v8", "data-apois-address-fields-v8", "data-apois-address-cep-row-v8", "data-apois-address-number-row-v8", "data-apois-address-city-row-v8", "data-apois-address-footer-v8", "onSubmit={handleSubmit}", "CustomerLocationAddressSelector", "hasPreciseLocation", "handleCEPBlur"]],
  ["selector", selector, ["data-apois-address-selector-v8", 'action: "reverse_geocode"', 'action: "autocomplete"', 'action: "place_details"', "onAddressSelected", "autoLocate"]],
  ["theme", readFileSync(cssPath, "utf8"), [marker, "data-apois-address-footer-v8", "color:#fff!important", "grid-template-columns:minmax(0,1fr) 126px"]]
]) {
  for (const token of tokens) if (!source.includes(token)) throw new Error("[FAIL] Visual V8 " + label + ": " + token);
}
console.log("[OK] Cliente Entregas: cadastro de endereco V8 compacto, claro, legivel e com teclado seguro; GPS/CEP e salvamento mantidos.");
