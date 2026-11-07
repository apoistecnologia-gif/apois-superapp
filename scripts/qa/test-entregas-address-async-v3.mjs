import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';

const root = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const read = path => readFileSync(`${root}/src/${path}`, 'utf8');
function block(source, begin, end) {
  const a = source.indexOf(begin), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, begin);
  return source.slice(a, b);
}
function deferred() { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; }
const selector = read('components/CustomerLocationAddressSelector.tsx');
const searchCode = block(selector, '  const search = async', '\n\n  const selectSuggestion');
function searchHarness() {
  const requests = [];
  const c = vm.createContext({
    searchRequestRef: { current: 0 },
    setQuery: value => c.query = value,
    setSuggestions: value => c.suggestions = value,
    invokeMaps: () => { const d = deferred(); requests.push(d); return d.promise; },
    console: { error() {} },
  });
  vm.runInContext(stripTypeScriptTypes(searchCode) + '\nthis.search = search;', c);
  return { c, requests };
}
test('autocomplete: older response cannot replace newer results', async () => {
  const { c, requests } = searchHarness();
  const old = c.search('Rua antiga'), current = c.search('Rua atual');
  requests[1].resolve({ predictions: ['atual'] }); await current;
  requests[0].resolve({ predictions: ['antiga'] }); await old;
  assert.equal(c.suggestions[0], 'atual');
});
test('autocomplete: clearing query cannot resurrect pending suggestions', async () => {
  const { c, requests } = searchHarness();
  const old = c.search('Rua antiga'); await c.search('');
  requests[0].resolve({ predictions: ['antiga'] }); await old;
  assert.equal(c.suggestions.length, 0);
});
test('autocomplete: stale failure cannot erase current results', async () => {
  const requests = [];
  const c = vm.createContext({
    searchRequestRef: { current: 0 }, setQuery() {},
    setSuggestions: value => c.suggestions = value,
    invokeMaps: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
    console: { error() {} },
  });
  vm.runInContext(stripTypeScriptTypes(searchCode) + '\nthis.search = search;', c);
  const old = c.search('Rua antiga'), current = c.search('Rua atual');
  requests[1].resolve({ predictions: ['atual'] }); await current;
  requests[0].reject(new Error('offline')); await old;
  assert.equal(c.suggestions[0], 'atual');
});

const form = read('routes/enderecos/novo.tsx');
const cepCode = block(form, '  const handleCEPBlur = async', '\n\n  const handleSubmit');
const helper = read('lib/brazil-uf.ts').replace('export function', 'function');
function cepHarness() {
  const requests = [];
  const c = vm.createContext({
    cepRequestRef: { current: 0 },
    formData: { postal_code: '11111111', street: '', neighborhood: '', city: '', state: '' },
    setFormData: update => c.formData = update(c.formData),
    fetch: () => { const d = deferred(); requests.push(d); return d.promise; },
    console: { error() {} },
  });
  vm.runInContext(stripTypeScriptTypes(helper + '\n' + cepCode) + '\nthis.lookup = handleCEPBlur;', c);
  const answer = (i, street) => requests[i].resolve({ ok: true, json: async () => ({ logradouro: street, bairro: 'Centro', localidade: 'Petrolina', uf: 'PE' }) });
  return { c, answer };
}
test('ViaCEP: previous CEP response cannot overwrite current address', async () => {
  const { c, answer } = cepHarness();
  const old = c.lookup(); c.formData = { ...c.formData, postal_code: '22222222' };
  const current = c.lookup(); answer(1, 'Rua atual'); await current;
  answer(0, 'Rua antiga'); await old;
  assert.equal(c.formData.street, 'Rua atual');
});
test('ViaCEP: editing CEP while waiting discards response even before another blur', async () => {
  const { c, answer } = cepHarness();
  const old = c.lookup(); c.formData = { ...c.formData, postal_code: '22222222' };
  answer(0, 'Rua antiga'); await old;
  assert.equal(c.formData.street, '');
});
test('ViaCEP: typed street while waiting is preserved', async () => {
  const { c, answer } = cepHarness();
  const pending = c.lookup(); c.formData = { ...c.formData, street: 'Rua digitada' };
  answer(0, 'Rua do CEP'); await pending;
  assert.equal(c.formData.street, 'Rua digitada');
  assert.equal(c.formData.state, 'PE');
});
