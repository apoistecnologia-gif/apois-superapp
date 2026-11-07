// Apply only to customer create-address and its customer-only selector, after UF V9/V10.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
function patch(path, before, after) {
  const file = resolve(root, path), source = readFileSync(file, 'utf8');
  if (source.includes(after)) return;
  if (source.split(before).length !== 2) throw new Error(`Address async V11: unexpected source ${path}`);
  writeFileSync(file, source.replace(before, after));
}
const selector = 'src/components/CustomerLocationAddressSelector.tsx';
patch(selector, '  const autoRan = useRef(false);',
  '  const autoRan = useRef(false);\n  const searchRequestRef = useRef(0); // APOIS_ADDRESS_ASYNC_V11');
patch(selector, '  const search = async (value: string) => {\n    setQuery(value);',
  '  const search = async (value: string) => {\n    const requestId = ++searchRequestRef.current;\n    setQuery(value);\n    setSuggestions([]);');
patch(selector,
  '      const data = await invokeMaps({ action: "autocomplete", input: value.trim() });\n      setSuggestions(Array.isArray(data?.predictions) ? data.predictions : []);',
  '      const data = await invokeMaps({ action: "autocomplete", input: value.trim() });\n      if (requestId !== searchRequestRef.current) return;\n      setSuggestions(Array.isArray(data?.predictions) ? data.predictions : []);');
patch(selector,
  '    } catch (error) {\n      console.error("Erro no autocomplete:", error);\n      setSuggestions([]);',
  '    } catch (error) {\n      if (requestId !== searchRequestRef.current) return;\n      console.error("Erro no autocomplete:", error);\n      setSuggestions([]);');
patch(selector, '  const selectSuggestion = async (suggestion: Suggestion) => {\n    setIsSearching(true);',
  '  const selectSuggestion = async (suggestion: Suggestion) => {\n    ++searchRequestRef.current; // Discard autocomplete still in flight after selection.\n    setIsSearching(true);');

const form = 'src/routes/enderecos/novo.tsx';
patch(form, '  const confirmedUfRef = useRef("");',
  '  const cepRequestRef = useRef(0); // APOIS_ADDRESS_ASYNC_V11\n  const confirmedUfRef = useRef("");');
patch(form,
  '    const cep = formData.postal_code.replace(/\\D/g, "");\n    if (cep.length !== 8) return;\n    try {',
  '    const requestId = ++cepRequestRef.current;\n    const requestedFields = { ...formData };\n    const cep = formData.postal_code.replace(/\\D/g, "");\n    if (cep.length !== 8) return;\n    try {');
patch(form,
  '      if (!data.erro) {\n        setFormData((previous) => ({\n          ...previous,\n          street: data.logradouro || previous.street,\n          neighborhood: data.bairro || previous.neighborhood,\n          city: data.localidade || previous.city,\n          state: normalizeBrazilUF(data.uf) || previous.state,\n        }));\n      }',
  '      if (!data.erro && requestId === cepRequestRef.current) {\n        setFormData((previous) => {\n          if (requestId !== cepRequestRef.current || previous.postal_code.replace(/\\D/g, "") !== cep) return previous;\n          return {\n            ...previous,\n            street: previous.street === requestedFields.street ? data.logradouro || previous.street : previous.street,\n            neighborhood: previous.neighborhood === requestedFields.neighborhood ? data.bairro || previous.neighborhood : previous.neighborhood,\n            city: previous.city === requestedFields.city ? data.localidade || previous.city : previous.city,\n            state: previous.state === requestedFields.state ? normalizeBrazilUF(data.uf) || previous.state : previous.state,\n          };\n        });\n      }');
patch(form,
  '            onAddressSelected={(address) => {\n              confirmedUfRef.current = normalizeBrazilUF(address.state);',
  '            onAddressSelected={(address) => {\n              ++cepRequestRef.current; // A newer selected point supersedes any pending CEP lookup.\n              confirmedUfRef.current = normalizeBrazilUF(address.state);');
console.log('[OK] Customer address async V11: stale autocomplete/CEP responses ignored; user edits retained.');
