// APOIS_ENTREGAS_ADDRESS_HANDLER_V16
//
// Regressão real detectada pelos testes de runtime em 07/11: depois que o
// hardener de deduplicação passou a normalizar o arquivo, o `handleChange` do
// cadastro voltou à versão mínima e perdeu duas regras de produto que existiam
// antes:
//
//   1. NÚMERO/COMPLEMENTO não movem o ponto confirmado. Digitar o número do
//      imóvel invalidava latitude/longitude e obrigava o cliente a localizar
//      tudo de novo — exatamente o defeito que o teste
//      test-entregas-address-number-runtime-v1 cobre.
//   2. UF EQUIVALENTE não move o ponto. O Google devolve "Pernambuco" e o
//      formulário salva "PE"; essa correção não muda o lugar, então não pode
//      descartar o GPS.
//
// Este hardener restaura as duas regras em UMA única versão do handleChange e
// é idempotente: sempre escreve o mesmo bloco final.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
const formPath = resolve(root, 'src/routes/enderecos/novo.tsx');

const canonicalHandler = `  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => {
      const previousValue = String(previous[name as keyof typeof previous] ?? "").trim();
      // APOIS_ADDRESS_HANDLER_V16: um campo que veio vazio da seleção atual pode
      // ser completado sem perder o ponto confirmado.
      const isCompletingMissingField =
        locationFields.has(name) &&
        (previousValue.length === 0 || missingLocationFieldsRef.current.has(name));
      // A troca "Pernambuco" -> "PE" não muda o lugar: o Google devolve o nome
      // por extenso e o formulário grava a sigla. UF realmente diferente invalida.
      const confirmedUf = normalizeBrazilUF(confirmedUfRef.current || previousValue);
      const nextUf = normalizeBrazilUF(value);
      const changedRealUf = name === "state" && Boolean(confirmedUf && nextUf && confirmedUf !== nextUf); // APOIS_UF_EQUIV_V16
      // Número e complemento identificam o imóvel dentro do mesmo ponto.
      const mustReconfirmPoint =
        name === "state"
          ? changedRealUf && !isCompletingMissingField
          : name !== "number" &&
            name !== "complement" &&
            locationFields.has(name) &&
            !isCompletingMissingField &&
            previousValue !== value.trim();

      return {
        ...previous,
        [name]: name === "state" ? value.toUpperCase() : value,
        ...(mustReconfirmPoint ? { latitude: null, longitude: null } : {}),
      };
    });
  };`;

let source = readFileSync(formPath, 'utf8');
const start = source.indexOf('  const handleChange =');
const end = source.indexOf('  const handleCEPBlur =', start);
if (start < 0 || end < 0) {
  console.error('[FAIL] Address handler V16: handleChange/handleCEPBlur não localizados');
  process.exit(1);
}
source = `${source.slice(0, start)}${canonicalHandler}${source.slice(end)}`;
writeFileSync(formPath, source, 'utf8');

// Contrato: as duas regras precisam estar no código final.
const final = readFileSync(formPath, 'utf8');
const handler = final.slice(final.indexOf('  const handleChange ='), final.indexOf('  const handleCEPBlur ='));
const failures = [];
if (!/name !== "number"/.test(handler)) failures.push('número ainda invalida o ponto confirmado');
if (!/name !== "complement"/.test(handler)) failures.push('complemento ainda invalida o ponto confirmado');
if (!/changedRealUf/.test(handler) || !/confirmedUf/.test(handler)) failures.push('UF equivalente ainda invalida o ponto');
if (!/missingLocationFieldsRef\.current\.has\(name\)/.test(handler)) failures.push('completar campo ausente ainda invalida o ponto');
if (!/latitude: null, longitude: null/.test(handler)) failures.push('alteração real de lugar não invalida o ponto');
if (failures.length) {
  console.error('[FAIL] Address handler V16: contrato não confirmado:');
  for (const item of failures) console.error(`  - ${item}`);
  process.exit(1);
}
console.log('[OK] Entregas: número/complemento e UF equivalente preservam o ponto; mudança real de lugar invalida.');
