import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { test } from 'node:test';

// Execute the generated production handler with React's functional state updater.
// This covers state transitions only; it does not claim device GPS or persistence E2E.
const form = readFileSync('.work/entregas/src/routes/enderecos/novo.tsx', 'utf8');
const helper = readFileSync('.work/entregas/src/lib/brazil-uf.ts', 'utf8');
const handlerStart = form.indexOf('  const handleChange =');
const handlerEnd = form.indexOf('  const handleCEPBlur =', handlerStart);
const fieldsStart = form.indexOf('const locationFields =');
const fieldsEnd = form.indexOf('\n]);', fieldsStart) + 4;
assert.ok(handlerStart >= 0 && handlerEnd > handlerStart && fieldsEnd > fieldsStart);
const code = stripTypeScriptTypes(
  helper.replace('export function', 'function') + '\n' +
  form.slice(fieldsStart, fieldsEnd) + '\n' +
  form.slice(handlerStart, handlerEnd) + '\nthis.change = handleChange;',
  { mode: 'strip' },
);
function harness(initial = {}) {
  const context = vm.createContext({
    state: { number: '', complement: '', street: 'Rua de teste', neighborhood: 'Centro', city: 'Petrolina', state: 'PE', postal_code: '56300000', latitude: -9.4, longitude: -40.5, ...initial },
    confirmedUfRef: { current: 'PE' },
    missingLocationFieldsRef: { current: new Set() },
  });
  context.setFormData = update => { context.state = update(context.state); };
  vm.runInContext(code, context);
  return { change: (name, value) => context.change({ target: { name, value } }), state: () => context.state };
}
function retainsGPS(h) { assert.equal(h.state().latitude, -9.4); assert.equal(h.state().longitude, -40.5); }

test('typing a multi-digit missing house number preserves the confirmed point', () => {
  const h = harness();
  for (const value of ['1', '12', '123', '123-A']) { h.change('number', value); retainsGPS(h); }
});
test('correcting an estimated house number preserves the user-confirmed point', () => {
  const h = harness({ number: '120' }); h.change('number', '123'); retainsGPS(h);
});
test('complement typing preserves the confirmed point', () => {
  const h = harness(); for (const v of ['A', 'Ap', 'Apto 2']) { h.change('complement', v); retainsGPS(h); }
});
test('equivalent UF correction preserves GPS', () => {
  const h = harness({ state: 'Pernambuco' }); h.change('state', 'PE'); retainsGPS(h);
});
test('another valid state invalidates GPS', () => {
  const h = harness(); h.change('state', 'BA'); assert.equal(h.state().latitude, null); assert.equal(h.state().longitude, null);
});
test('changing street or city invalidates GPS', () => {
  for (const field of ['street', 'city']) { const h = harness(); h.change(field, 'Outro lugar'); assert.equal(h.state().latitude, null); }
});
test('typing a number does not invent missing coordinates', () => {
  const h = harness({ latitude: null, longitude: null }); h.change('number', '123'); assert.equal(h.state().latitude, null); assert.equal(h.state().longitude, null);
});
