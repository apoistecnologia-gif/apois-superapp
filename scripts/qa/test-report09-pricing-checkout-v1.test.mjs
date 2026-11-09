// Testes isolados, sem APIs externas ou dados reais.
// Exercita o callback extraído do TSX integrado, com serviço simulado.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const workspace = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
function read(path) { return readFileSync(resolve(workspace, path), "utf8"); }

const pricing = read("src/hooks/use-pricing.tsx");
const startToken = "  const calculatePricing = useCallback(";
const start = pricing.indexOf(startToken);
const end = pricing.indexOf("}, [request, requestKey]);", start);
assert.ok(start >= 0 && end > start, "callback report09 não encontrado no TSX integrado");
const callbackCode = pricing.slice(start + startToken.length, end + 1);

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

function harness(service) {
  const state = {
    status: "idle", statusKey: "", appliedKey: "", error: null, estimates: [],
  };
  const latestRequestKeyRef = { current: "" };
  const activeRequestRef = { current: null };
  const lastSuccessfulRef = { current: null };
  const displayedSuccessRef = { current: false };
  const requestSequenceRef = { current: 0 };
  const setters = {
    setStatus: (v) => { state.status = v; },
    setStatusKey: (v) => { state.statusKey = v; },
    setAppliedKey: (v) => { state.appliedKey = v; },
    setError: (v) => { state.error = v; },
    setEstimates: (v) => { state.estimates = v; },
  };
  function callback(key, request = { key }) {
    latestRequestKeyRef.current = key;
    displayedSuccessRef.current =
      state.status === "success" && state.statusKey === key && state.appliedKey === key;
    return vm.runInNewContext("(" + callbackCode + ")", {
      request, requestKey: key, latestRequestKeyRef, activeRequestRef,
      lastSuccessfulRef, displayedSuccessRef, requestSequenceRef, ...setters,
      pricingService: service, Date, console: { error() {} },
    });
  }
  return { callback, state, latestRequestKeyRef, lastSuccessfulRef };
}

function result(price) {
  return { estimates: [{ categoryId: "carro", available: true, estimatedPrice: price }] };
}

test("INV-058: falha permite repetir a mesma estimativa, sem mudar destino", async () => {
  let calls = 0;
  const h = harness({ estimateFares: async () => {
    calls++;
    if (calls === 1) throw Error("rede indisponível");
    return result(40);
  } });
  await h.callback("A")();
  assert.equal(h.state.status, "error");
  assert.equal(calls, 1);
  await h.callback("A")();
  assert.equal(calls, 2);
  assert.equal(h.state.status, "success");
  assert.equal(h.state.estimates[0].estimatedPrice, 40);
});

test("INV-058: solicitações simultâneas iguais compartilham serviço", async () => {
  let calls = 0;
  const pending = deferred();
  const h = harness({ estimateFares: () => { calls++; return pending.promise; } });
  const fn = h.callback("A");
  const first = fn();
  const second = fn();
  assert.equal(calls, 1);
  pending.resolve(result(40));
  await Promise.all([first, second]);
  assert.equal(h.state.status, "success");
});

test("INV-059: A lenta não substitui resposta B mais recente", async () => {
  const a = deferred(), b = deferred();
  const h = harness({ estimateFares: ({ key }) => key === "A" ? a.promise : b.promise });
  const old = h.callback("A")();
  const newer = h.callback("B")();
  b.resolve(result(40));
  await newer;
  a.resolve(result(10));
  await old;
  assert.equal(h.state.estimates[0].estimatedPrice, 40);
  assert.equal(h.state.appliedKey, "B");
  assert.equal(h.state.status, "success");
});

test("INV-059: erro da A anterior não apaga sucesso da B", async () => {
  const a = deferred(), b = deferred();
  const h = harness({ estimateFares: ({ key }) => key === "A" ? a.promise : b.promise });
  const old = h.callback("A")();
  const newer = h.callback("B")();
  b.resolve(result(40));
  await newer;
  a.reject(Error("falha antiga"));
  await old;
  assert.equal(h.state.status, "success");
  assert.equal(h.state.error, null);
  assert.equal(h.state.estimates[0].estimatedPrice, 40);
});

test("INV-059: clear durante cálculo não aplica resposta antiga", async () => {
  const a = deferred();
  const h = harness({ estimateFares: () => a.promise });
  const old = h.callback("A")();
  h.latestRequestKeyRef.current = "";
  a.resolve(result(10));
  await old;
  assert.equal(h.state.appliedKey, "");
  assert.deepEqual(h.state.estimates, []);
});

test("INV-058/059: A-B-A não fica em loading por cache de sucesso anterior", async () => {
  let calls = 0;
  const b = deferred();
  const h = harness({
    estimateFares: ({ key }) => {
      calls++;
      if (key === "B") return b.promise;
      return Promise.resolve(result(22));
    },
  });
  await h.callback("A")();
  assert.equal(h.state.status, "success");
  const olderB = h.callback("B")();
  await h.callback("A")();
  assert.equal(h.state.statusKey, "A");
  assert.equal(h.state.appliedKey, "A");
  assert.equal(calls, 3);
  b.resolve(result(99));
  await olderB;
  assert.equal(h.state.estimates[0].estimatedPrice, 22);
});

test("INV-060: três camadas e confirmação aplicam gates explícitos", () => {
  const route = read("src/hooks/use-route.tsx");
  const checkout = read("src/hooks/use-checkout-preparation.tsx");
  const request = read("src/hooks/rides/use-ride-request.tsx");
  const review = read("src/routes/_authenticated.revisar-solicitacao.tsx");
  const home = read("src/routes/_authenticated.inicio.tsx");
  const fares = read("src/components/pricing/FareDetails.tsx");
  assert.match(route, /APOIS_REPORT09_ROUTE_CURRENT_V1/);
  assert.match(route, /route\.intermediates/);
  assert.match(route, /routeIsCurrent/);
  assert.match(pricing, /latestRequestKeyRef\.current !== requestKey/);
  assert.match(pricing, /appliedKey === requestKey/);
  assert.match(checkout, /!routeIsCurrent/);
  assert.match(checkout, /!pricingIsCurrent/);
  assert.match(request, /latest\.checkout\.readiness/);
  assert.match(request, /latest\.route === route/);
  assert.match(request, /stopsSignatureRef\.current === JSON\.stringify\(route\.intermediates/);
  assert.match(home, /APOIS_REPORT09_HOME_GUARD_V1/);
  assert.match(review, /APOIS_REPORT09_REVIEW_GUARD_V1/);
  assert.match(fares, /Tentar novamente/);
});
