import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || ".work/corridas");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const marker = "APOIS_PASSENGER_AUDIT_20261123";

test("Passenger special-category fields are actually editable, not placeholders", () => {
  const form = read("src/components/pricing/ServiceDetailsForm.tsx");
  for (const token of [marker, "itemPesado", "ajudantes", "tipoVeiculo", "weightKg", "setServiceDetails", "onChange=", "Salvar detalhes"]) {
    assert.ok(form.includes(token), "Missing service form token: " + token);
  }
  assert.ok(!form.includes("Form implementation for each category would go here"));
});

test("Quote signatures and request payload share exactly the same service details", () => {
  const pricing = read("src/hooks/use-pricing.tsx");
  const types = read("src/types/pricing.ts");
  const request = read("src/hooks/rides/use-ride-request.tsx");
  const requestTypes = read("src/types/rides/ride-request.ts");
  const review = read("src/routes/_authenticated.revisar-solicitacao.tsx");
  for (const token of [marker, "serviceDetails: serviceDetails as Record<string, unknown>", "categories, serviceDetails"]) assert.ok(pricing.includes(token));
  assert.ok(types.includes("serviceDetails?: Record<string, unknown>"));
  for (const token of [marker, "service_details: { ...serviceDetails", "detailsSignature", "expected_price_cents", "error_code === \"price_changed\""]) assert.ok(request.includes(token));
  assert.ok(requestTypes.includes("expected_price_cents?: number"));
  assert.ok(review.includes("Object.entries(serviceDetails)"));
});

test("Confirmed fare is checked by the backend, not accepted from the passenger", () => {
  const generated = read("supabase/functions/request-ride/index.ts");
  const source = readFileSync(resolve("supabase/functions/request-ride/index.ts"), "utf8");
  for (const text of [generated, source]) {
    for (const token of ["expected_price_cents", "authoritativePriceCents", "error_code: \"price_changed\"", "409"]) {
      assert.ok(text.includes(token), "Missing price contract " + token);
    }
    const fareIndex = text.indexOf("const estimatedPrice = ");
    const guardIndex = text.indexOf("const expectedPriceCents =");
    const insertIndex = text.indexOf("const { data: ride, error: insertError }");
    assert.ok(fareIndex >= 0 && guardIndex > fareIndex, "Quote check must follow server tariff");
    assert.ok(insertIndex > guardIndex, "Quote check must precede insert");
  }
});

test("Network failure during recovery never means no active ride", () => {
  const review = read("src/routes/_authenticated.revisar-solicitacao.tsx");
  assert.ok(review.includes("activeRideService.getActiveRide(profile.id)"));
  assert.ok(review.includes('toast.error("Não foi possível verificar sua corrida ativa.'));
  assert.ok(!review.includes("await recoverActiveRide()"));
});

test("Cancelled ride displays its cancellation fee instead of estimated full fare", () => {
  const screen = read("src/routes/_authenticated.corrida.$rideId.tsx");
  assert.ok(screen.includes("Taxa de Cancelamento"));
  assert.ok(screen.includes("ride.cancellation_fee ?? 0"));
  assert.ok(screen.includes('if (screenState === "completed")'));
});

test("Abort signals and GPS watcher cleanup survive build transformations", () => {
  const request = read("src/hooks/rides/use-ride-request.tsx");
  const routes = read("src/services/routes/route-service.ts");
  const gps = read("src/hooks/use-location.tsx");
  assert.ok(request.includes("APOIS_PASSENGER_AUDIT_ABORT_V1"));
  assert.ok(request.includes("signal: controller.signal"));
  assert.ok(!request.includes("return await Promise.race(["));
  assert.ok(routes.includes("signal: controller.signal"));
  for (const token of ["let disposed = false;", "const pendingWatchId = await Geolocation.watchPosition(", "await Geolocation.clearWatch({ id: pendingWatchId });", "disposed = true;"]) {
    assert.ok(gps.includes(token), "GPS listener race guard missing " + token);
  }
});
