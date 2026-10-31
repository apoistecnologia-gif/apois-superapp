import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sourcePath = process.env.APOIS_JOURNEY_TEST_SOURCE || 'scripts/fix-partner-courier-simple-journey-v1.mjs';
const script = readFileSync(sourcePath, 'utf8');
const match = script.match(/const transitions=("(?:\\.|[^"\\])*");/);
assert.ok(match, 'actual generated transitions literal must exist');
const transitions = JSON.parse(match[1]);
const effectSource = transitions.slice(0, transitions.indexOf('  const transitionDelivery ='))
  .replaceAll('catch (error: any)', 'catch (error)');
// Execute the real generated effect with a controlled lifecycle and deferred RPC.
// No React UI, Supabase client, credentials or network calls are involved.
const install = new Function('useEffect', 'activeJob', 'courier',
  'startingNavigationRef', 'startingNavigationAttemptRef',
  'setBusy', 'courierActionWithTimeout', 'rpc', 'toast',
  'loadCourierOperations', effectSource);

function harness() {
  let busy = null;
  const requests = [];
  const reloads = [];
  const errors = [];
  const jobRef = { current: null };
  const attemptRef = { current: 0 };
  return {
    get busy() { return busy; },
    requests, reloads, errors,
    start(id) {
      let cleanup;
      install(
        callback => { cleanup = callback(); },
        { id, status: 'accepted' }, { id: 'courier-test' }, jobRef, attemptRef,
        value => { busy = typeof value === 'function' ? value(busy) : value; },
        value => value,
        (name, args) => new Promise((resolve, reject) => requests.push({ name, args, resolve, reject })),
        { error: message => errors.push(message) },
        async id => { reloads.push(id); },
      );
      return cleanup;
    },
  };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('successful navigation releases busy and refreshes operations', async () => {
  const h = harness();
  h.start('job-1');
  assert.equal(h.busy, 'delivery');
  assert.equal(h.requests[0].name, 'courier_transition_delivery');
  assert.deepEqual(h.requests[0].args, { _delivery_job_id: 'job-1', _new_status: 'arriving_pickup' });
  h.requests[0].resolve({ error: null });
  await settle();
  assert.equal(h.busy, null);
  assert.deepEqual(h.reloads, ['courier-test']);
});

test('realtime status cleanup before RPC completion still releases busy', async () => {
  const h = harness();
  const cleanup = h.start('job-1');
  cleanup(); // accepted -> arriving_pickup changes the effect dependencies.
  h.requests[0].resolve({ error: null });
  await settle();
  assert.equal(h.busy, null);
  assert.deepEqual(h.reloads, [], 'disposed effect must not reload stale operations');
});

test('an older completion cannot unlock a newer navigation request', async () => {
  const h = harness();
  const cleanup = h.start('job-1');
  cleanup();
  h.start('job-2');
  h.requests[0].resolve({ error: null });
  await settle();
  assert.equal(h.busy, 'delivery');
  h.requests[1].resolve({ error: null });
  await settle();
  assert.equal(h.busy, null);
});

test('a rejected request after realtime cleanup also releases busy', async () => {
  const h = harness();
  const cleanup = h.start('job-1');
  cleanup();
  h.requests[0].reject(new Error('synthetic offline failure'));
  await settle();
  assert.equal(h.busy, null);
  assert.deepEqual(h.errors, [], 'disposed effect must not show stale toasts');
});
