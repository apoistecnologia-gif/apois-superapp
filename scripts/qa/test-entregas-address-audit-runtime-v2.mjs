import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';

const root = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const read = path => readFileSync(`${root}/src/${path}`, 'utf8');
function extract(source, start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `Missing production block ${start}`);
  return source.slice(a, b);
}
const listing = read('routes/enderecos.tsx');
const coordinateCode = extract(listing, 'const hasCoordinates =', '\n\nfunction EnderecosLayout');
const coordinateContext = vm.createContext({});
vm.runInContext(stripTypeScriptTypes(coordinateCode.replace(': CustomerAddress', '')) + '\nthis.check = hasCoordinates;', coordinateContext);
for (const [name, latitude, longitude, expected] of [
  ['null pair', null, null, false], ['missing latitude', null, -40.5, false],
  ['empty strings', '', '', false], ['whitespace', ' ', ' ', false],
  ['undefined', undefined, undefined, false], ['NaN', NaN, -40.5, false],
  ['out of range', -91, -40.5, false], ['real numeric zero', 0, 0, true],
  ['numeric database strings', '-9.4', '-40.5', true], ['real point', -9.4, -40.5, true],
]) test(`address coordinates: ${name}`, () => assert.equal(coordinateContext.check({ latitude, longitude }), expected));

const edit = read('routes/enderecos/editar/$addressId.tsx');
const fields = extract(edit, 'const locationFields =', '\n\nfunction EditarEndereco');
const change = extract(edit, '  const handleChange =', '\n\n  const handleSubmit =');
const helper = read('lib/brazil-uf.ts').replace('export function', 'function');
function harness() {
  const context = vm.createContext({
    missingLocationFieldsRef: { current: new Set() },
    state: { street: 'Rua de teste', number: '', complement: '', neighborhood: 'Centro', city: 'Petrolina', state: 'PE', postal_code: '56300000', latitude: -9.4, longitude: -40.5 },
  });
  context.setFormData = update => context.state = update(context.state);
  vm.runInContext(stripTypeScriptTypes(helper + '\n' + fields + '\n' + change) + '\nthis.change = handleChange;', context);
  return context;
}
test('edit: multi-digit house number retains confirmed GPS', () => {
  const h = harness();
  for (const number of ['1', '12', '123', '123-A']) {
    h.change({ target: { name: 'number', value: number } });
    assert.equal(h.state.latitude, -9.4); assert.equal(h.state.longitude, -40.5);
  }
});
test('edit: complement retains GPS', () => {
  const h = harness(); h.change({ target: { name: 'complement', value: 'Apto 2' } });
  assert.equal(h.state.latitude, -9.4);
});
test('edit: changed street still requires point confirmation', () => {
  const h = harness(); h.change({ target: { name: 'street', value: 'Outra rua' } });
  assert.equal(h.state.latitude, null); assert.equal(h.state.longitude, null);
});
test('edit: changing to a different UF invalidates GPS', () => {
  const h = harness(); h.change({ target: { name: 'state', value: 'BA' } });
  assert.equal(h.state.latitude, null);
});
test('edit: re-entering the same street retains GPS', () => {
  const h = harness(); h.change({ target: { name: 'street', value: 'Rua de teste' } });
  assert.equal(h.state.latitude, -9.4);
});

const submit = extract(edit, '  const handleSubmit =', '\n\n  if (isLoading)');
function submitHarness(state) {
  const c = vm.createContext({
    formData: { label: 'Casa', street: 'Rua de teste', number: '123', complement: '', neighborhood: 'Centro', city: 'Cidade de teste', state, postal_code: '56300-000', latitude: -9.4, longitude: -40.5 },
    addressId: 'synthetic-address', setIsSaving() {},
    toast: { error: message => c.error = message, success() {} },
    navigate: async () => {}, console: { error() {} },
    supabase: { from: table => ({ update: payload => ({ eq: async (field, id) => { c.saved = { table, payload, field, id }; return { error: null }; } }) }) },
  });
  vm.runInContext(stripTypeScriptTypes(helper + '\n' + submit) + '\nthis.submit = handleSubmit;', c);
  return c;
}
test('edit submission: all 27 full state names persist as canonical UF', async () => {
  const states = [['Acre','AC'],['Alagoas','AL'],['Amapá','AP'],['Amazonas','AM'],['Bahia','BA'],['Ceará','CE'],['Distrito Federal','DF'],['Espírito Santo','ES'],['Goiás','GO'],['Maranhão','MA'],['Mato Grosso','MT'],['Mato Grosso do Sul','MS'],['Minas Gerais','MG'],['Pará','PA'],['Paraíba','PB'],['Paraná','PR'],['Pernambuco','PE'],['Piauí','PI'],['Rio de Janeiro','RJ'],['Rio Grande do Norte','RN'],['Rio Grande do Sul','RS'],['Rondônia','RO'],['Roraima','RR'],['Santa Catarina','SC'],['São Paulo','SP'],['Sergipe','SE'],['Tocantins','TO']];
  for (const [state, uf] of states) {
    const c = submitHarness(state); await c.submit({ preventDefault() {} });
    assert.equal(c.saved?.payload.state, uf, state);
    assert.equal(c.saved.payload.postal_code, '56300000');
    assert.equal(c.saved.payload.latitude, -9.4);
  }
});
test('edit submission: invalid two-letter state never reaches update', async () => {
  const c = submitHarness('XX'); await c.submit({ preventDefault() {} });
  assert.equal(c.saved, undefined); assert.ok(c.error);
});
test('edit submission: missing point never reaches update', async () => {
  const c = submitHarness('PE'); c.formData.latitude = null;
  await c.submit({ preventDefault() {} }); assert.equal(c.saved, undefined); assert.ok(c.error);
});
