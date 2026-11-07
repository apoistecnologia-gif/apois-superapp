// APOIS_ENTREGAS_UF_FORM_V9: full state names from geocoders -> 27 valid siglas.
// Changes are applied only in .work/entregas after all existing functional/visual hardeners.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||".work/entregas");
const formPath=resolve(root,"src/routes/enderecos/novo.tsx");
const selectorPath=resolve(root,"src/components/CustomerLocationAddressSelector.tsx");
const ufPath=resolve(root,"src/lib/brazil-uf.ts");
const marker="APOIS_ENTREGAS_UF_FORM_V9";

function replaceOnce(source,oldPart,newPart,label){
  if(source.includes(newPart))return source;
  const occurrences=source.split(oldPart).length-1;
  if(occurrences!==1)throw Error("[FAIL] UF V9 "+label+": expected 1 match, found "+occurrences);
  return source.replace(oldPart,newPart);
}
mkdirSync(dirname(ufPath),{recursive:true});
const helper=String.raw`// APOIS_ENTREGAS_UF_FORM_V9: pure utility, no network, no app state.
const UF_BY_NAME: Record<string,string>={
  "ACRE":"AC","ALAGOAS":"AL","AMAPA":"AP","AMAZONAS":"AM",
  "BAHIA":"BA","CEARA":"CE","DISTRITO FEDERAL":"DF","ESPIRITO SANTO":"ES",
  "GOIAS":"GO","MARANHAO":"MA","MATO GROSSO":"MT","MATO GROSSO DO SUL":"MS",
  "MINAS GERAIS":"MG","PARA":"PA","PARAIBA":"PB","PARANA":"PR",
  "PERNAMBUCO":"PE","PIAUI":"PI","RIO DE JANEIRO":"RJ","RIO GRANDE DO NORTE":"RN",
  "RIO GRANDE DO SUL":"RS","RONDONIA":"RO","RORAIMA":"RR","SANTA CATARINA":"SC",
  "SAO PAULO":"SP","SERGIPE":"SE","TOCANTINS":"TO"
};
const UF_CODES=new Set(Object.values(UF_BY_NAME));
export function normalizeBrazilUF(input:unknown):string{
  const raw=String(input??"").trim();
  if(!raw)return "";
  const key=raw.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[.-]/g," ").replace(/\s+/g," ").trim().toUpperCase();
  return UF_CODES.has(key)?key:(UF_BY_NAME[key]??"");
}
`;
writeFileSync(ufPath,helper,"utf8");

let selector=readFileSync(selectorPath,"utf8");
selector=replaceOnce(selector,
  'import { toast } from "sonner";',
  'import { toast } from "sonner";\nimport { normalizeBrazilUF } from "@/lib/brazil-uf"; // APOIS_ENTREGAS_UF_FORM_V9',
  "selector import");
selector=replaceOnce(selector,
  '    state: getShort("administrative_area_level_1"),',
  '    state: normalizeBrazilUF(getShort("administrative_area_level_1")) || normalizeBrazilUF(getLong("administrative_area_level_1")),',
  "reverse geocode state normalization");
writeFileSync(selectorPath,selector,"utf8");

let form=readFileSync(formPath,"utf8");
form=replaceOnce(form,
  'import { useEffect, useState } from "react";',
  'import { useEffect, useRef, useState } from "react";',
  "form useRef import");
form=replaceOnce(form,
  'import { CustomerLocationAddressSelector } from "@/components/CustomerLocationAddressSelector";',
  'import { CustomerLocationAddressSelector } from "@/components/CustomerLocationAddressSelector";\nimport { normalizeBrazilUF } from "@/lib/brazil-uf"; // APOIS_ENTREGAS_UF_FORM_V9',
  "form normalization import");
form=replaceOnce(form,
  '  const [autoLocate, setAutoLocate] = useState(false);',
  '  const [autoLocate, setAutoLocate] = useState(false);\n  const confirmedUfRef = useRef(""); // Preserve original GPS position during full-name -> UF correction.',
  "retain GPS state while editing");
form=replaceOnce(form,
  '      const mustReconfirmPoint = locationFields.has(name) && !isCompletingMissingField;',
  [
   '      // A troca Pernambuco -> PE nao altera o lugar e nao pode apagar GPS.',
   '      // Uma UF completa realmente diferente ainda invalida a posicao ate nova confirmacao.',
   '      const confirmedUf = normalizeBrazilUF(confirmedUfRef.current || previousValue);',
   '      const nextUf = normalizeBrazilUF(value);',
   '      const changedRealUf = name === "state" && Boolean(confirmedUf && nextUf && confirmedUf !== nextUf);',
   '      const mustReconfirmPoint = name === "state"',
   '        ? changedRealUf',
   '        : name !== "number" && locationFields.has(name) && !isCompletingMissingField && previousValue !== value.trim();'
  ].join("\n"),
  "protect coordinates on equivalent UF edits");
form=replaceOnce(form,
  '        [name]: value,\n        ...(mustReconfirmPoint ? { latitude: null, longitude: null } : {}),',
  '        [name]: name === "state" ? value.toUpperCase() : value,\n        ...(mustReconfirmPoint ? { latitude: null, longitude: null } : {}),',
  "uppercase manual UF");
form=replaceOnce(form,
  '  const hasIdentifiedAddress = Boolean(formData.street.trim() && formData.neighborhood.trim() && formData.city.trim() && formData.state.trim());',
  '  const hasIdentifiedAddress = Boolean(formData.street.trim() && formData.neighborhood.trim() && formData.city.trim() && normalizeBrazilUF(formData.state));',
  "accurate GPS identified status");
form=replaceOnce(form,
  '          state: data.uf || previous.state,',
  '          state: normalizeBrazilUF(data.uf) || previous.state,',
  "ViaCEP valid UF");
form=replaceOnce(form,
  '    if (formData.state.trim().length !== 2) {',
  '    if (!normalizeBrazilUF(formData.state)) {',
  "accept valid UF not merely two random letters");
form=replaceOnce(form,
  '      toast.error("O estado (UF) deve ter exatamente 2 letras");',
  '      toast.error("UF inválida. Confira a sigla do estado, por exemplo PE.");',
  "error message");
form=replaceOnce(form,
  '        state: formData.state.toUpperCase(),',
  '        state: normalizeBrazilUF(formData.state),',
  "persist canonical UF");
form=replaceOnce(form,
  '            onAddressSelected={(address) => {\n              setFormData((previous) => ({',
  '            onAddressSelected={(address) => {\n              confirmedUfRef.current = normalizeBrazilUF(address.state);\n              setFormData((previous) => ({',
  "capture GPS-normalized state");
form=replaceOnce(form,
  '                state: address.state || previous.state,',
  '                state: normalizeBrazilUF(address.state) || previous.state,',
  "auto-fill UF as PE not Pernambuco");
for(const [name,code] of [["selector",selector],["form",form]]){
  if(!code.includes(marker))throw Error("[FAIL] UF V9 marker missing in "+name);
}
writeFileSync(formPath,form,"utf8");
console.log("[OK] Entregas Cliente: 27 estados normalizados, UF validada e coordenadas GPS preservadas na correção equivalente.");
