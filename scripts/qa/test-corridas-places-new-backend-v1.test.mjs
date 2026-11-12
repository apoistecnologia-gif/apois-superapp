// APOIS_CORRIDAS_PLACES_NEW_V1 — deterministic offline contract regression.
// No Google Cloud credentials, HTTP calls, billable API requests, or Supabase mutations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { placesNewAutocomplete, placesNewDetails, normalizePlacesNewPrediction, normalizePlacesNewDetails } from "../../supabase/functions/google-maps-address/places-new-compat.mjs";

const source = readFileSync("supabase/functions/google-maps-address/index.ts", "utf8");
const example = {
  suggestions: [
    { placePrediction: {
      placeId: "ChIJ123example",
      text: { text: "Rua do Pavao, Petrolina, Pernambuco, Brasil" },
      structuredFormat: {
        mainText: { text: "Rua do Pavao" },
        secondaryText: { text: "Petrolina, Pernambuco, Brasil" },
      },
    }},
    { queryPrediction: { text: { text: "query prediction cannot be picked as a place" } } },
  ],
};
test("Autocomplete (New): POST, safe field mask and legacy-compatible suggestions", async () => {
  let calls = 0;
  const result = await placesNewAutocomplete("KEY_TEST_ONLY", "Rua do Pavao", -9.39, -40.50, async (url, options) => {
    calls++;
    assert.equal(url, "https://places.googleapis.com/v1/places:autocomplete");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-Goog-Api-Key"], "KEY_TEST_ONLY");
    const mask = options.headers["X-Goog-FieldMask"];
    assert.ok(mask.includes("suggestions.placePrediction.placeId"));
    assert.ok(!mask.includes("photos") && !mask.includes("*"));
    assert.ok(options.signal);
    const body = JSON.parse(options.body);
    assert.equal(body.input, "Rua do Pavao");
    assert.equal(body.languageCode, "pt-BR");
    assert.deepEqual(body.includedRegionCodes, ["br"]);
    assert.equal(body.locationBias.circle.center.latitude, -9.39);
    assert.equal(body.locationBias.circle.radius, 50000);
    return { ok: true, json: async () => example };
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, [{
    place_id: "ChIJ123example",
    description: "Rua do Pavao, Petrolina, Pernambuco, Brasil",
    structured_formatting: { main_text: "Rua do Pavao", secondary_text: "Petrolina, Pernambuco, Brasil" },
  }]);
});
test("Autocomplete excludes query predictions and missing IDs; no accidental charged request for fewer than 3 chars", async () => {
  let called = 0;
  assert.deepEqual(await placesNewAutocomplete("KEY_TEST_ONLY","ab",undefined,undefined,async()=>{called++;}),[]);
  assert.equal(called,0);
  assert.equal(normalizePlacesNewPrediction({ queryPrediction:{text:{text:"test"}} }),null);
});
test("Place Details (New): GET with essentials-only fields and numeric coordinates", async () => {
  let calls = 0;
  const result = await placesNewDetails("KEY_TEST_ONLY","ChIJ123example",async (url, options) => {
    calls++;
    assert.ok(url.startsWith("https://places.googleapis.com/v1/places/ChIJ123example"));
    assert.equal(options.method,"GET");
    assert.equal(options.headers["X-Goog-Api-Key"],"KEY_TEST_ONLY");
    const mask = options.headers["X-Goog-FieldMask"];
    assert.ok(mask.includes("location") && mask.includes("addressComponents"));
    assert.ok(!mask.includes("displayName") && !mask.includes("*"));
    assert.equal(options.body,undefined);
    return {ok:true,json:async()=>({
      location:{latitude:-9.395,longitude:-40.501},
      formattedAddress:"Rua do Pavao, Petrolina - PE",
      addressComponents:[
        {longText:"Rua do Pavao",shortText:"R. do Pavao",types:["route"]},
        {longText:"Petrolina",shortText:"Petrolina",types:["locality"]},
      ],
    })};
  });
  assert.equal(calls,1);
  assert.deepEqual(result.geometry.location,{lat:-9.395,lng:-40.501});
  assert.deepEqual(result.address_components[0],{long_name:"Rua do Pavao",short_name:"R. do Pavao",types:["route"]});
});
test("Reject invalid coordinates and Google errors without leaking key",async()=>{
  assert.throws(()=>normalizePlacesNewDetails({location:{latitude:1,longitude:"-40"}}),/invalid coordinates/);
  assert.throws(()=>normalizePlacesNewDetails({location:{latitude:91,longitude:0}}),/invalid coordinates/);
  await assert.rejects(
    placesNewAutocomplete("KEY_TEST_ONLY","Petrolina",undefined,undefined,async()=>({ok:false,status:403})),
    e=>e.message.includes("HTTP 403") && !e.message.includes("KEY_TEST_ONLY"),
  );
  await assert.rejects(placesNewDetails("KEY_TEST_ONLY","https://evil.invalid",async()=>{}),/invalid place id/);
});
test("Live Edge function retains Supabase JWT, per-user quota, reverse-geocoding and Photon fallback",()=>{
  for (const v of [
    'const quota = await consumeLookupQuota(req);',
    'if (!quota.allowed) return json({ error: quota.error }, quota.status);',
    'if (req.method !== "POST")',
    'const GOOGLE_LOOKUP_TIMEOUT_MS = 2400;',
    'const fallbackResults = await nominatimReverse(lat, lng);',
    'const predictions = await nominatimSearch(localizedInput, lat, lng);',
    'const apiKey =',
    'Deno.env.get("GOOGLE_MAPS_CORRIDAS_API_KEY")',
    'placesNewAutocomplete(',
    'placesNewDetails(',
    'provider: "google_places_new"',
  ])assert.ok(source.includes(v),v);
  assert.ok(!source.includes("maps.googleapis.com/maps/api/place/autocomplete/json"));
  assert.ok(!source.includes("maps.googleapis.com/maps/api/place/details/json"));
  assert.ok(!source.includes("VITE_GOOGLE_MAPS_API_KEY"));
});
