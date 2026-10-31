import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// CI reads the fully transformed workspace after build:partner.
// Local before/after reproduction applies the actual two callback substitutions
// from the chosen transformer to the pinned callback, not a rewritten algorithm.
const input = process.env.APOIS_MANUAL_TEST_SOURCE || '.work/partner-entregador/src/routes/courier.tsx';
let generated = readFileSync(input, 'utf8');
if (process.env.APOIS_MANUAL_TEST_SCRIPT) {
  const script = readFileSync(process.env.APOIS_MANUAL_TEST_SCRIPT, 'utf8');
  const start = script.indexOf('const edits = ') + 'const edits = '.length;
  const end = script.indexOf('\nfor (const [oldText', start);
  const edits = JSON.parse(script.slice(start, end).trim().replace(/;$/, ''));
  for (const [before, after, label] of edits.filter(edit =>
    ['loadAll signature', 'load initial operations'].includes(edit[2]))) {
    assert.ok(generated.includes(before), 'source drift: ' + label);
    generated = generated.replace(before, after);
  }
}
const begin = generated.indexOf('  const loadAll = useCallback(');
const end = generated.indexOf('  useEffect(() => {', begin);
assert.ok(begin >= 0 && end > begin, 'real loadAll callback must be located');
const code = generated.slice(begin, end).replaceAll('catch (error: any)', 'catch (error)');
const createLoad = new Function('useCallback', 'useRef', 'supabase', 'from',
  'setRefreshing', 'setLoading', 'setAppError', 'setUser', 'setCourier',
  'setDocuments', 'loadCourierOperations', 'toast', 'initialEntryResetPendingRef', 'setOperationsError',
  code + '\nreturn loadAll;');

function harness() {
  const h = { authFailures: 0, operationFailures: 0, approved: true, resets: [], errors: [] };
  const auth = { auth: { getUser: async () => h.authFailures-- > 0
    ? { data: { user: null }, error: new Error('synthetic connection failure') }
    : { data: { user: { id: 'auth-test' } }, error: null } } };
  const from = table => ({
    select() { return this; },
    eq() { return this; },
    maybeSingle: async () => ({ data: { id: 'courier-test', status: h.approved ? 'approved' : 'pending', is_active: true }, error: null }),
    order: async () => ({ data: [], error: null }),
  });
  const noop = () => {};
  h.load = createLoad(value => value, value => ({ current: value }), auth, from,
    noop, noop, error => h.errors.push(error), noop, noop, noop,
    async (id, reset = false) => {
      assert.equal(id, 'courier-test');
      h.resets.push(reset);
      if (h.operationFailures-- > 0) throw new Error('synthetic operations failure');
    }, { error: noop }, { current: true }, noop);
  return h;
}

test('retry after initial auth failure still requests entry offline verification', async () => {
  const h = harness();
  h.authFailures = 1;
  await h.load(false, true);
  assert.deepEqual(h.resets, []);
  await h.load();
  assert.deepEqual(h.resets, [true]);
});

test('retry after initial operations failure repeats entry verification', async () => {
  const h = harness();
  h.operationFailures = 1;
  await h.load(false, true);
  await h.load();
  assert.deepEqual(h.resets, [true, true]);
});

test('ordinary refresh after verified entry does not reset manual availability', async () => {
  const h = harness();
  await h.load(false, true);
  await h.load(true);
  assert.deepEqual(h.resets, [true, false]);
});

test('first approved operations load is verified after an initial pending profile', async () => {
  const h = harness();
  h.approved = false;
  await h.load(false, true);
  h.approved = true;
  await h.load();
  assert.deepEqual(h.resets, [true]);
});

test('a later refresh failure never reinstates the entry reset', async () => {
  const h = harness();
  await h.load(false, true);
  h.operationFailures = 1;
  await h.load(true);
  await h.load(true);
  assert.deepEqual(h.resets, [true, false, false]);
});
