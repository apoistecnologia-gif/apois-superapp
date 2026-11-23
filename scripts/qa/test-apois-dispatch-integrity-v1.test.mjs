// APOIS_DISPATCH_INTEGRITY_V1: runs actual TS engine under Node 22 type stripping.
// No live database, HTTP, SDK, deployed endpoints, FCM, or production data.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findEligibleDriversForRide } from "../../supabase/functions/_shared/dispatch-engine.ts";

const now = Date.parse("2026-11-23T12:00:00.000Z");
const passenger = "11111111-1111-4111-8111-111111111111";
const driverA = "22222222-2222-4222-8222-222222222222";
const driverB = "33333333-3333-4333-8333-333333333333";
const nearLat = -9.38, nearLng = -40.50;
const ride = (extras = {}) => ({
  id: "44444444-4444-4444-8444-444444444444",
  passenger_id: passenger,
  category: "carros",
  origin_lat: nearLat, origin_lng: nearLng,
  candidate_driver_ids: [], offered_driver_ids: [], rejected_driver_ids: [],
  ...extras,
});
const driver = (userId, extras = {}) => ({
  id: userId,
  user_id: userId,
  category: "carros",
  is_online: true,
  approval_status: "aprovado",
  subscription_status: "active",
  current_lat: nearLat, current_lng: nearLng,
  last_location_at: new Date(now).toISOString(),
  ...extras,
});
const choose = (r, drivers, options = {}) => findEligibleDriversForRide({
  ride: r, drivers, activeRides: [], queuedDriverIds: [],
  options: { nowMs: now, ...options },
});

test("A user registered as both passenger and driver cannot be offered own ride", () => {
  const match = choose(ride(), [driver(passenger), driver(driverA)]);
  assert.deepEqual(match.offeredUserIds, [driverA]);
  assert.ok(!match.remainingCandidateUserIds.includes(passenger));
  assert.ok(!match.eligible.some((candidate) => candidate.userId === passenger));
});

test("Missing passenger identity fails closed instead of dispatching offers", () => {
  const match = choose(ride({ passenger_id: "" }), [driver(driverA)]);
  assert.deepEqual(match.offeredUserIds, []);
  assert.deepEqual(match.eligible, []);
});

test("No GPS fix must not be interpreted as 0, and (0,0) is not a valid fix", () => {
  for (const coords of [
    { current_lat: null, current_lng: 0 },
    { current_lat: "", current_lng: "" },
    { current_lat: " ", current_lng: 0 },
    { current_lat: 0, current_lng: 0 },
    { current_lat: 91, current_lng: 0 },
    { current_lat: nearLat, current_lng: -181 },
  ]) {
    assert.deepEqual(choose(ride(), [driver(driverA, coords)]).offeredUserIds, [],
      "Invalid driver position must not be eligible " + JSON.stringify(coords));
  }
  assert.deepEqual(choose(ride({ origin_lat: null }), [driver(driverA)]).offeredUserIds, []);
  assert.deepEqual(choose(ride({ origin_lat: 0, origin_lng: 0 }), [driver(driverA)]).offeredUserIds, []);
});

test("Valid nearby GPS and current category/subscription work unchanged", () => {
  const eligible = choose(ride(), [driver(driverA)]);
  assert.deepEqual(eligible.offeredUserIds, [driverA]);
  assert.deepEqual(eligible.remainingCandidateUserIds, []);
  for (const invalid of [
    { is_online: false }, { approval_status: "pendente" },
    { subscription_status: "expired" }, { category: "motos" },
    { last_location_at: null },
    { last_location_at: new Date(now - 121_000).toISOString() },
  ]) {
    assert.deepEqual(choose(ride(), [driver(driverA, invalid)]).offeredUserIds, []);
  }
});

test("Rejected and previously offered candidates are never reoffered", () => {
  assert.deepEqual(choose(ride({ rejected_driver_ids: [driverA] }), [driver(driverA)]).offeredUserIds, []);
  assert.deepEqual(choose(ride({ offered_driver_ids: [driverA] }), [driver(driverA)]).offeredUserIds, []);
  assert.deepEqual(choose(ride(), [driver(driverA), driver(driverB)], {
    remainingPoolUserIds: [driverB],
  }).offeredUserIds, [driverB]);
});

test("Next ride remains available to eligible busy driver near their destination", () => {
  const args = {
    ride: ride(),
    drivers: [driver(driverA)],
    activeRides: [{
      id: "55555555-5555-4555-8555-555555555555",
      driver_id: driverA, status: "em_viagem",
      destination_lat: nearLat, destination_lng: nearLng,
    }],
    queuedDriverIds: [],
    options: { nowMs: now },
  };
  assert.deepEqual(findEligibleDriversForRide(args).offeredUserIds, [driverA]);
  assert.deepEqual(findEligibleDriversForRide({ ...args, queuedDriverIds: [driverA] }).offeredUserIds, []);
  assert.deepEqual(findEligibleDriversForRide({ ...args,
    activeRides: [{ ...args.activeRides[0], destination_lat: null, destination_lng: 0 }],
  }).offeredUserIds, []);
});

test("Entry point forwards DB passenger_id, never an untrusted request payload", () => {
  const source = readFileSync("supabase/functions/dispatch-ride/index.ts", "utf8");
  assert.match(source, /passenger_id:\s*text\(rawRide\.passenger_id\)/);
  assert.match(source, /\.from\("rides"\)\s*\.select\("\*"\)/);
  assert.doesNotMatch(source, /passenger_id:\s*text\(body\./);
  assert.match(source, /findEligibleDriversForRide\(/);
});
