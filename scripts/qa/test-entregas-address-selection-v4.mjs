import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';
const root = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const read = p => readFileSync(`${root}/src/${p}`, 'utf8');
const uf = read('lib/brazil-uf.ts').replace('export function', 'function');
for (const [name, path, parameter] of [
  ['create', 'routes/enderecos/novo.tsx', 'address'],
  ['edit', 'routes/enderecos/editar/$addressId.tsx', 'addr'],
]) {
  const source = read(path), marker = `onAddressSelected={(${parameter}) => {`;
  const a = source.indexOf(marker), b = source.indexOf('\n            }}', a);
  assert.ok(a >= 0 && b > a, path);
  const callback = source.slice(a + 'onAddressSelected={'.length, b) + '\n}';
  function harness() {
    const c = vm.createContext({
      setIsLookingUpCEP() {},
    missingLocationFieldsRef: { current: new Set() },
      state: { label: 'Casa', street: 'Rua antiga', neighborhood: 'Bairro antigo', city: 'Cidade antiga', state: 'PE', postal_code: '11111111', number: '123', complement: 'Apto 2', latitude: -9.4, longitude: -40.5 },
      confirmedUfRef: { current: 'PE' }, cepRequestRef: { current: 0 },
    });
    c.setFormData = update => c.state = update(c.state);
    vm.runInContext(stripTypeScriptTypes(uf + '\nthis.select = ' + callback), c);
    return c;
  }
  test(`${name}: new partial point cannot inherit the previous street/number/CEP`, () => {
    const c = harness();
    c.select({ street: '', number: '', neighborhood: '', city: 'Juazeiro', state: 'BA', postal_code: '', latitude: -9.43, longitude: -40.49 });
    assert.equal(c.state.street, ''); assert.equal(c.state.number, '');
    assert.equal(c.state.postal_code, ''); assert.equal(c.state.neighborhood, '');
    assert.equal(c.state.city, 'Juazeiro'); assert.equal(c.state.state, 'BA');
    assert.equal(c.state.latitude, -9.43);
    assert.equal(c.state.label, 'Casa'); assert.equal(c.state.complement, 'Apto 2');
  });
  test(`${name}: incomplete coordinates never inherit a previous confirmed point`, () => {
    for (const [latitude, longitude] of [[null,null],[-9.43,undefined],[NaN,-40.49],[91,-40.49],[-9.43,-181],['-9.43',-40.49]]) {
      const c = harness();
      c.select({ street: 'Rua nova', state: 'BA', latitude, longitude });
      assert.equal(c.state.latitude, null); assert.equal(c.state.longitude, null);
    }
  });
  test(`${name}: complete new selection retains fields and canonical state`, () => {
    const c = harness();
    c.select({ street: 'Rua nova', number: '45', neighborhood: 'Centro', city: 'Juazeiro', state: 'Bahia', postal_code: '48900000', latitude: -9.43, longitude: -40.49 });
    assert.equal(c.state.street, 'Rua nova'); assert.equal(c.state.number, '45');
    assert.equal(c.state.state, 'BA'); assert.equal(c.state.postal_code, '48900000');
    assert.equal(c.state.longitude, -40.49);
  });
}
