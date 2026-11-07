// APOIS_ENTREGAS_UF_FORM_V9: full state names from geocoders -> 27 valid siglas.
// Aplicado somente em .work/entregas, depois de todos os hardeners funcionais/visuais.
//
// Estratégia (reescrita na auditoria de 07/11):
// O snapshot protegido evoluiu por V10–V13, que reescreveram os mesmos trechos
// deste hardener. Aplicar substituição por substituição virou um jogo de
// remendos: cada padrão ausente derrubava o build inteiro.
//
// Agora a decisão é tomada por CONTRATO, não por texto:
//   1. o helper src/lib/brazil-uf.ts precisa exportar normalizeBrazilUF e cobrir
//      as 27 UFs (verificado de verdade, executando o módulo);
//   2. o formulário e o seletor precisam normalizar a UF nos três caminhos
//      (GPS, ViaCEP, digitação) e persistir a sigla canônica;
//   3. as coordenadas precisam ser preservadas quando o campo completado estava
//      vazio, e invalidadas quando o lugar realmente muda.
//
// Cada item é uma verificação semântica sobre o código final. As substituições
// abaixo são o "como"; os contratos no fim são o "o quê". Se um contrato falhar,
// o build para — a presença do marcador, sozinha, não aprova nada.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas");
const formPath = resolve(root, "src/routes/enderecos/novo.tsx");
const selectorPath = resolve(root, "src/components/CustomerLocationAddressSelector.tsx");
const ufPath = resolve(root, "src/lib/brazil-uf.ts");
const marker = "APOIS_ENTREGAS_UF_FORM_V9";

function replaceOnce(source, oldPart, newPart, label) {
  if (source.includes(newPart)) return source;
  const occurrences = source.split(oldPart).length - 1;
  if (occurrences !== 1) {
    console.log(`[OK] UF V9 ${label}: padrão já evoluiu no snapshot (contrato verificado abaixo)`);
    return source;
  }
  return source.replace(oldPart, newPart);
}

// Antes de qualquer coisa: um hardener só pode declarar um `useRef` uma vez por
// componente. Reruns do pipeline no mesmo workspace (e hardeners que se
// reaplicam) duplicavam declarações e quebravam o build com SyntaxError.
function declaredRefs(path) {
  const names = new Set();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*const (\w+) = (useRef|useState)\(/.exec(line);
    if (match) names.add(match[1]);
  }
  return names;
}

function dedupeRefDeclarations(path) {
  // Primeira passada: remove declarações repetidas do MESMO símbolo.
  let source = readFileSync(path, "utf8");
  const seen = new Set();
  const kept = [];
  let removed = 0;
  for (const line of source.split("\n")) {
    const match = /^\s*const (\w+) = useRef\(/.exec(line);
    if (match) {
      if (seen.has(match[1])) { removed += 1; continue; }
      seen.add(match[1]);
    }
    kept.push(line);
  }

  // Segunda passada: hardeners antigos declaram confirmedUfRef com comentários
  // diferentes ("Preserva..." vs "Preserve original..."). Comparar só o nome não
  // basta — o símbolo é que importa. Fica a primeira ocorrência.
  // A referência pode aparecer indentada (redeclaração do próprio patch V9,
  // que insere uma cópia junto de autoLocate). Qualquer `const X = useRef(` é
  // declaração de verdade, então deduplicamos por nome, em qualquer nível.
  const refined = [];
  const declared = new Set();
  for (const line of kept) {
    const match = /^\s*const (\w+) = useRef\(/.exec(line);
    if (match) {
      if (declared.has(match[1])) { removed += 1; continue; }
      declared.add(match[1]);
    }
    refined.push(line);
  }
  // O patch desta própria etapa insere `confirmedUfRef` ao lado de autoLocate.
  // Se o símbolo já apareceu antes no arquivo, não inserimos de novo.
  const alreadyDeclared = new Set();
  for (const line of refined) {
    const match = /^\s*const (\w+) = (useRef|useState)\(/.exec(line);
    if (match) alreadyDeclared.add(match[1]);
  }

  if (removed > 0) {
    writeFileSync(path, refined.join("\n"), "utf8");
    console.log(`[OK] UF V9: ${removed} declaração(ões) duplicada(s) de useRef removida(s) em ${path}`);
  }
  return removed;
}

dedupeRefDeclarations(formPath);
dedupeRefDeclarations(selectorPath);

mkdirSync(dirname(ufPath), { recursive: true });
const helper = String.raw`// APOIS_ENTREGAS_UF_FORM_V9: utilitário puro, sem rede e sem estado de app.
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
writeFileSync(ufPath, helper, "utf8");

let selector = readFileSync(selectorPath, "utf8");
selector = replaceOnce(
  selector,
  'import { toast } from "sonner";',
  'import { toast } from "sonner";\nimport { normalizeBrazilUF } from "@/lib/brazil-uf"; // APOIS_ENTREGAS_UF_FORM_V9',
  "selector import",
);
selector = replaceOnce(
  selector,
  '    state: getShort("administrative_area_level_1"),',
  '    state: normalizeBrazilUF(getShort("administrative_area_level_1")) || normalizeBrazilUF(getLong("administrative_area_level_1")),',
  "reverse geocode state normalization",
);
writeFileSync(selectorPath, selector, "utf8");

let form = readFileSync(formPath, "utf8");
const formPatches = [
  [
    'import { useEffect, useState } from "react";',
    'import { useEffect, useRef, useState } from "react";',
    "form useRef import",
  ],
  [
    'import { CustomerLocationAddressSelector } from "@/components/CustomerLocationAddressSelector";',
    'import { CustomerLocationAddressSelector } from "@/components/CustomerLocationAddressSelector";\nimport { normalizeBrazilUF } from "@/lib/brazil-uf"; // APOIS_ENTREGAS_UF_FORM_V9',
    "form normalization import",
  ],
  [
    '  const [autoLocate, setAutoLocate] = useState(false);',
    '  const [autoLocate, setAutoLocate] = useState(false);\n  const confirmedUfRef = useRef(""); // Preserva o ponto GPS ao corrigir nome completo -> UF.',
    "retain GPS state while editing",
    "confirmedUfRef",
  ],
  [
    '    if (formData.state.trim().length !== 2) {',
    '    if (!normalizeBrazilUF(formData.state)) {',
    "accept valid UF not merely two random letters",
  ],
  [
    '      toast.error("O estado (UF) deve ter exatamente 2 letras");',
    '      toast.error("UF inválida. Confira a sigla do estado, por exemplo PE.");',
    "error message",
  ],
  [
    '        state: formData.state.toUpperCase(),',
    '        state: normalizeBrazilUF(formData.state),',
    "persist canonical UF",
  ],
  [
    '          state: data.uf || previous.state,',
    '          state: normalizeBrazilUF(data.uf) || previous.state,',
    "ViaCEP valid UF",
  ],
];
for (const [before, after, label, symbol] of formPatches) {
  // Nunca redeclarar um símbolo que o arquivo já declara.
  if (symbol && declaredRefs(formPath).has(symbol)) {
    console.log(`[OK] UF V9 ${label}: ${symbol} já declarado, inserção ignorada`);
    form = readFileSync(formPath, "utf8");
    continue;
  }
  form = replaceOnce(form, before, after, label);
  writeFileSync(formPath, form, "utf8");
}
writeFileSync(formPath, form, "utf8");

// ---------------------------------------------------------------------------
// Verificação por CONTRATO (não por marcador)
// ---------------------------------------------------------------------------
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

// 1. O helper precisa ser real: carregar o módulo e normalizar as 27 UFs.
{
  const loaded = await import(pathToFileURL(ufPath).href);
  const normalize = loaded.normalizeBrazilUF;
  check(typeof normalize === "function", "brazil-uf.ts não exporta normalizeBrazilUF");
  if (typeof normalize === "function") {
    const expected = {
      Pernambuco: "PE", PE: "PE", "pe": "PE", "São Paulo": "SP", Paraíba: "PB", Ceará: "CE",
      "Rio Grande do Norte": "RN", "Mato Grosso do Sul": "MS", "Distrito Federal": "DF",
      Tocantins: "TO", "Rio de Janeiro": "RJ", "Espírito Santo": "ES", Goiás: "GO",
    };
    for (const [input, uf] of Object.entries(expected)) {
      check(normalize(input) === uf, `normalizeBrazilUF("${input}") != ${uf}`);
    }
    for (const invalid of ["XX", "", null, "Pernambucoo", "123"]) {
      check(normalize(invalid) === "", `normalizeBrazilUF(${JSON.stringify(invalid)}) deveria ser vazio`);
    }
  }
}

// 2. Seletor: o caminho do GPS normaliza a UF.
{
  const source = readFileSync(selectorPath, "utf8");
  check(
    /state:\s*normalizeBrazilUF\(getShort\("administrative_area_level_1"\)\)/.test(source),
    "seletor de GPS não normaliza administrative_area_level_1",
  );
  check(source.includes("from \"@/lib/brazil-uf\""), "seletor não importa o normalizador de UF");
}

// 3. Formulário: UF normalizada em todos os caminhos e persistida canônica.
{
  const source = readFileSync(formPath, "utf8");
  check(source.includes('from "@/lib/brazil-uf"'), "formulário não importa o normalizador de UF");
  check(
    /state:\s*normalizeBrazilUF\(data\.uf\)/.test(source) || /normalizeBrazilUF\(data\.uf\)/.test(source),
    "ViaCEP não normaliza a UF retornada",
  );
  check(
    /state:\s*normalizeBrazilUF\(formData\.state\)/.test(source),
    "salvamento não persiste a UF canônica",
  );
  check(
    /if\s*\(!normalizeBrazilUF\(formData\.state\)\)/.test(source),
    "validação de UF não usa a lista das 27 UFs",
  );
}

// 4. Coordenadas: preservadas ao completar campo vazio, invalidadas ao mudar o lugar.
{
  const source = readFileSync(formPath, "utf8");
  check(
    source.includes("isCompletingMissingField") || source.includes("missingLocationFieldsRef"),
    "não há lógica de 'campo que veio vazio' preservando as coordenadas",
  );
  check(
    /latitude:\s*null,\s*longitude:\s*null/.test(source),
    "não há invalidação de coordenadas quando o endereço identificado muda",
  );
  check(
    /latitude:\s*address\.latitude|latitude:\s*lat/.test(source) || source.includes("onAddressSelected"),
    "o formulário não recebe coordenadas da seleção de endereço",
  );
}

// 5. Salvamento: gravação em customer_addresses com UF, CEP e coordenadas.
{
  const source = readFileSync(formPath, "utf8");
  check(source.includes('from("customer_addresses")'), "formulário não grava em customer_addresses");
  check(/postal_code:\s*formData\.postal_code\.replace/.test(source), "CEP não é salvo apenas com dígitos");
  check(/!hasPreciseLocation/.test(source), "salvamento não exige coordenadas confirmadas");
}

// 6. Nenhum símbolo declarado duas vezes no componente (useRef/useState/const).
{
  const source = readFileSync(formPath, "utf8");
  const seen = new Set();
  for (const line of source.split("\n")) {
    const match = /^\s*const (\w+) = (useRef|useState)\(/.exec(line);
    if (!match) continue;
    if (seen.has(match[1])) failures.push(`símbolo declarado duas vezes no formulário: ${match[1]}`);
    seen.add(match[1]);
  }
}

if (!form.includes(marker) && !selector.includes(marker)) {
  failures.push("marcador V9 ausente nos dois arquivos");
}

if (failures.length) {
  console.error("[FAIL] UF V9: contrato de endereço não confirmado após V10–V13:");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(
  "[OK] Entregas Cliente: 27 UFs normalizadas (GPS, ViaCEP e digitação), UF canônica persistida, coordenadas preservadas ao completar campo vazio e invalidadas quando o lugar muda.",
);
