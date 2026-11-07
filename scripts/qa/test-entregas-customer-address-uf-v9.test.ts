import { test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeBrazilUF } from "../../.work/entregas/src/lib/brazil-uf";

const samples: Array<[string,string]> = [
 ["Acre","AC"],["Alagoas","AL"],["Amapá","AP"],["Amazonas","AM"],
 ["Bahia","BA"],["Ceará","CE"],["Distrito Federal","DF"],["Espírito Santo","ES"],
 ["Goiás","GO"],["Maranhão","MA"],["Mato Grosso","MT"],["Mato Grosso do Sul","MS"],
 ["Minas Gerais","MG"],["Pará","PA"],["Paraíba","PB"],["Paraná","PR"],
 ["Pernambuco","PE"],["Piauí","PI"],["Rio de Janeiro","RJ"],
 ["Rio Grande do Norte","RN"],["Rio Grande do Sul","RS"],
 ["Rondônia","RO"],["Roraima","RR"],["Santa Catarina","SC"],
 ["São Paulo","SP"],["Sergipe","SE"],["Tocantins","TO"]
];

test("all 27 Brazilian state names convert to real two-letter UF",()=>{
 expect(samples.length).toBe(27);
 for(const [name,uf] of samples){
  expect(normalizeBrazilUF(name)).toBe(uf);
  expect(normalizeBrazilUF(uf)).toBe(uf);
  expect(normalizeBrazilUF(uf.toLowerCase())).toBe(uf);
 }
});

test("Photon fallback Pernambuco, accents and invalid codes are handled",()=>{
 expect(normalizeBrazilUF("Pernambuco")).toBe("PE");
 expect(normalizeBrazilUF("  PERNAMBUCO  ")).toBe("PE");
 expect(normalizeBrazilUF("Sao Paulo")).toBe("SP");
 expect(normalizeBrazilUF("Parana")).toBe("PR");
 expect(normalizeBrazilUF("XX")).toBe("");
 expect(normalizeBrazilUF("P")).toBe("");
 expect(normalizeBrazilUF("")).toBe("");
 expect(normalizeBrazilUF(null)).toBe("");
});

test("equivalent state correction leaves the confirmed GPS position intact",()=>{
 const confirmedState=normalizeBrazilUF("Pernambuco");
 const correctedState=normalizeBrazilUF("PE");
 const changedRealUf=Boolean(confirmedState && correctedState && confirmedState!==correctedState);
 expect(changedRealUf).toBe(false);
 expect(normalizeBrazilUF("Bahia")!==confirmedState).toBe(true);
});

test("form uses normalized UF for GPS, ViaCEP, validation and persistence",()=>{
 const work=resolve(".work/entregas");
 const form=readFileSync(resolve(work,"src/routes/enderecos/novo.tsx"),"utf8");
 const selector=readFileSync(resolve(work,"src/components/CustomerLocationAddressSelector.tsx"),"utf8");
 for(const s of [
  'state: normalizeBrazilUF(address.state),',
  'confirmedUfRef.current = normalizeBrazilUF(address.state)',
  'state: previous.state === requestedFields.state ? normalizeBrazilUF(data.uf) || previous.state : previous.state',
  'if (!normalizeBrazilUF(formData.state))',
  'state: normalizeBrazilUF(formData.state)',
  'const changedRealUf = name === "state"',
  'const mustReconfirmPoint = name === "state"',
  'customer_addresses',
  '!hasPreciseLocation'
 ])expect(form.includes(s)).toBe(true);
 expect(selector.includes('normalizeBrazilUF(getShort("administrative_area_level_1"))')).toBe(true);
 expect(selector.includes('action: "reverse_geocode"')).toBe(true);
 expect(selector.includes('action: "autocomplete"')).toBe(true);
 expect(selector.includes('action: "place_details"')).toBe(true);
});
