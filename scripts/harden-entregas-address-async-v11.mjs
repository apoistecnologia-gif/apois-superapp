// Apply only to customer create-address and its customer-only selector, after UF V9/V10.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
function patch(path, before, after, options = {}) {
  const file = resolve(root, path), source = readFileSync(file, 'utf8');
  if (source.includes(after)) return;
  const occurrences = source.split(before).length - 1;
  if (occurrences === 1) {
    writeFileSync(file, source.replace(before, after));
    return;
  }
  // O snapshot fixado pode já conter a proteção (ou o trecho pode ter sido
  // reescrito por outro hardener). Só é erro quando o efeito esperado não
  // existe em nenhuma forma — aí o build precisa parar.
  if (options.marker && source.includes(options.marker)) {
    console.log(`[OK] Address async V11: ${path} já protegido (${options.marker})`);
    return;
  }
  if (options.optional) {
    console.log(`[OK] Address async V11: ${path} não usa este trecho no snapshot atual`);
    return;
  }
  throw new Error(`Address async V11: unexpected source ${path}`);
}
const selector = 'src/components/CustomerLocationAddressSelector.tsx';
// The Client pipeline applies CV11 visual feedback before the final bundled
// address-audit pass. Preserve that richer version on reruns, but verify the
// actual latest-only guards and visible retry/error/empty states.
const selectorSource = readFileSync(resolve(root, selector), 'utf8');
if (selectorSource.includes('APOIS_CV11_AUTOCOMPLETE_FEEDBACK_V1')) {
  for (const guard of [
    'APOIS_ADDRESS_ASYNC_V11',
    'const requestId = ++searchRequestRef.current;',
    'if (requestId !== searchRequestRef.current) return;',
    '++searchRequestRef.current; // Discard autocomplete still in flight after selection.',
    'setAutocompleteStatus("error")',
    'setAutocompleteStatus(matches.length === 0 ? "empty" : "ready")',
    'Tentar novamente',
    'Nenhum endereço encontrado',
  ]) {
    if (!selectorSource.includes(guard)) throw Error('Address async V11: incomplete CV11 visual guard ' + guard);
  }
  console.log('[OK] Address async V11: CV11 feedback already applied with latest-only guards');
} else {
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

}

const form = 'src/routes/enderecos/novo.tsx';
// cepRequestRef é declarado uma única vez. Ancorar em `confirmedUfRef` duplicava
// o símbolo quando o hardener rodava mais de uma vez no mesmo workspace.
patch(form,
  '  const [autoLocate, setAutoLocate] = useState(false);',
  '  const [autoLocate, setAutoLocate] = useState(false);\n  const cepRequestRef = useRef(0); // APOIS_ADDRESS_ASYNC_V11',
  { marker: 'cepRequestRef' });
patch(form,
  '  const handleCEPBlur = async () => {',
  '  const handleCEPBlur = async () => {\n    const requestId = ++cepRequestRef.current;\n    const requestedFields = { ...formData };');
patch(form, '      const data = await response.json();', '      const data = await response.json();\n      if(requestId !== cepRequestRef.current)return;');
// The complete builder adds CEP validation, a loading flag and a visible lookup CTA.
// Keep those controls while letting a newer CEP supersede the pending request.
if (readFileSync(resolve(root, form), 'utf8').includes('APOIS_ENTREGAS_CEP_LOOKUP_V1')) {
  patch(form,
    '    if(cep.length>0&&cep.length!==8){toast.error("O CEP precisa ter 8 números.");return;}',
    '    if(cep.length>0&&cep.length!==8){setIsLookingUpCEP(false);toast.error("O CEP precisa ter 8 números.");return;}');
  patch(form, '    if (cep.length !== 8) return;', '    if (cep.length !== 8) { setIsLookingUpCEP(false); return; }');
  patch(form, '    if(isLookingUpCEP)return;', '    // APOIS_CEP_LATEST_REQUEST_V11: latest request controls the lookup state.');
  patch(form, '    }finally{setIsLookingUpCEP(false);}', '    }finally{if(requestId === cepRequestRef.current)setIsLookingUpCEP(false);}');
  patch(form, '      console.error("CEP fetch error:", error);', '      if(requestId !== cepRequestRef.current)return;\n      console.error("CEP fetch error:", error);');
}
patch(form,
  '      if (!data.erro) {\n        setFormData((previous) => ({\n          ...previous,\n          street: data.logradouro || previous.street,\n          neighborhood: data.bairro || previous.neighborhood,\n          city: data.localidade || previous.city,\n          state: normalizeBrazilUF(data.uf) || previous.state,\n        }));\n      }',
  '      if (!data.erro && requestId === cepRequestRef.current) {\n        setFormData((previous) => {\n          if (requestId !== cepRequestRef.current || previous.postal_code.replace(/\\D/g, "") !== cep) return previous;\n          return {\n            ...previous,\n            street: previous.street === requestedFields.street ? data.logradouro || previous.street : previous.street,\n            neighborhood: previous.neighborhood === requestedFields.neighborhood ? data.bairro || previous.neighborhood : previous.neighborhood,\n            city: previous.city === requestedFields.city ? data.localidade || previous.city : previous.city,\n            state: previous.state === requestedFields.state ? normalizeBrazilUF(data.uf) || previous.state : previous.state,\n          };\n        });\n      }', { marker: 'requestId === cepRequestRef.current' });
patch(form,
  '            onAddressSelected={(address) => {\n              confirmedUfRef.current = normalizeBrazilUF(address.state);',
  '            onAddressSelected={(address) => {\n              ++cepRequestRef.current; // A newer selected point supersedes any pending CEP lookup.\n              confirmedUfRef.current = normalizeBrazilUF(address.state);',
  { optional: true });
if (readFileSync(resolve(root, form), 'utf8').includes('APOIS_ENTREGAS_CEP_LOOKUP_V1')) {
  patch(form,
    '              ++cepRequestRef.current; // A newer selected point supersedes any pending CEP lookup.',
    '              ++cepRequestRef.current; // A newer selected point supersedes any pending CEP lookup.\n              setIsLookingUpCEP(false);',
    { marker: 'setIsLookingUpCEP(false)' });
}
console.log('[OK] Customer address async V11: stale autocomplete/CEP responses ignored; user edits retained.');
