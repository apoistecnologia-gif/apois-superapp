// Guardas estaticas: consentimento de tarifa. Nao gera apps e nao acessa producao.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const server=readFileSync("supabase/functions/request-ride/index.ts","utf8");
const reviewScript=readFileSync("scripts/fix-apois-corridas-fare-consent-e2e-v1.mjs","utf8");
const marker="APOIS_FARE_CONSENT_E2E_V1";
assert.ok(server.includes(marker),"request-ride must enforce price consent");
assert.ok(server.includes('error_code: "price_changed"'),"server sends changed price");
assert.ok(server.includes("expected_price_cents"),"server receives passenger quote");
const guard=server.indexOf('if (body?.expected_price_cents !== undefined');
const calc=server.indexOf('const estimatedPrice = await loadFare(');
const insert=server.indexOf('await admin.from("rides").insert(');
assert.ok(calc>=0 && guard>calc && insert>guard,"fare re-confirmation must happen before ride insert");
assert.ok(reviewScript.includes('updatedFareCents'),"review must display changed fare");
assert.ok(reviewScript.includes('Math.round(checkout.finalTotal * 100)'),"review must pass quoted price in cents");
assert.ok(reviewScript.includes('return null;'),"price change must not create ride in client handler");
assert.ok(reviewScript.includes('expected_price_cents?: number;'),"type contract must include quote");
console.log("[OK] Corridas: fare consent contract before request insert; no app or production action.");
