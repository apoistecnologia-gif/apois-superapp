// Regressão do bug maps_api_unavailable: loading=async dispara 'load'
// antes do Maps JavaScript chamar o callback de prontidão.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { patchMapsJavaScriptLoader } from './apois-maps-loader-callback.mjs';

const originalPath = 'sources/apois-corridas-passageiro/src/services/google/google-maps-loader.ts';
const original = readFileSync(originalPath, 'utf8');
const patched = patchMapsJavaScriptLoader(original);
assert.equal(patchMapsJavaScriptLoader(patched), patched, 'patch precisa ser idempotente');
assert.ok(!patched.includes('auth_referrer_policy: "origin"'));
const CALLBACK = '__apoisGoogleMapsJavascriptReady';

function fixture() {
  const scripts = new Map();
  let nextTimer = 0;
  const timers = new Map();
  const win = {
    google: undefined,
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  const doc = {
    getElementById(id) { return scripts.get(id) ?? null; },
    createElement(type) {
      assert.equal(type, 'script');
      const events = {};
      return {
        async: false,
        defer: false,
        id: '',
        src: '',
        onload: undefined,
        onerror: undefined,
        addEventListener(event, callback) { events[event] = callback; },
        emit(event) { events[event]?.(); },
      };
    },
    head: { appendChild(script) { scripts.set(script.id, script); } },
  };

  const source = patched
    .replace(/^import \{ PLACES_CONFIG \} from .*;\s*$/m, '')
    .replace('export const googleMapsLoader = GoogleMapsLoader.getInstance();',
      'globalThis.__apoisTestLoader = GoogleMapsLoader.getInstance();');
  const runnable = stripTypeScriptTypes(source, { mode: 'strip' });
  const context = { window: win, document: doc, URLSearchParams, PLACES_CONFIG: { TIMEOUT_MS: 3500 } };
  vm.runInNewContext(runnable, context, { timeout: 2500 });
  const loader = context.__apoisTestLoader;
  assert.ok(loader, 'loader do app nao inicializado');
  return {
    win, doc, loader, scripts, timers,
    script() { return scripts.get('apois-google-maps-js'); },
  };
}

{
  const f = fixture();
  let done = false;
  const requested = f.loader.load();
  requested.then(() => { done = true; });
  const script = f.script();
  assert.ok(script, 'script do Google ausente');
  const query = new URL(script.src).searchParams;
  assert.equal(query.get('loading'), 'async');
  assert.equal(query.get('callback'), CALLBACK);
  assert.equal(query.has('auth_referrer_policy'), false);
  // Evento load ANTES da prontidao nao pode falhar prematuramente.
  script.onload();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(done, false, 'load resolveu antes da callback');
  f.win.google = { maps: { importLibrary: async (name) => ({ name }) } };
  assert.equal(typeof f.win[CALLBACK], 'function');
  f.win[CALLBACK]();
  await requested;
  assert.equal(done, true, 'callback nao desbloqueou a Promise');
  assert.equal(f.win[CALLBACK], undefined, 'callback ficou exposta apos sucesso');
  const lib = await f.loader.importLibrary('maps');
  assert.equal(lib.name, 'maps');
  assert.equal(f.timers.size, 0, 'timeout pendente apos sucesso');
}
{
  const f = fixture();
  const requested = f.loader.load();
  f.script().onerror();
  await assert.rejects(requested, /maps_script_failed/);
  assert.equal(f.win[CALLBACK], undefined, 'callback persistiu apos erro de rede');
  assert.equal(f.timers.size, 0, 'timeout persistiu apos erro');
  f.loader.reset();
  assert.equal(f.script(), undefined, 'retry nao removeu a tag anterior');
}
{
  const f = fixture();
  const requested = f.loader.load();
  f.script().onload();
  const timeout = [...f.timers.values()][0];
  timeout();
  await assert.rejects(requested, /maps_timeout/);
  assert.equal(f.win[CALLBACK], undefined, 'callback persistiu apos timeout');
}

console.log('[OK] Maps Loader: callback async, load prematuro, erro, timeout, retry, limpeza e paleta preservados.');
