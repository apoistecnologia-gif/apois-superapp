import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

// Static contract tests for the VIS/CV 01 overlay generators.
// These DO NOT replace a real browser/Android render or a full partner build.
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8');
const driver = read('scripts/harden-partner-motorista-visual-v18.mjs');
const passenger = read('scripts/harden-corridas-kit-visual.mjs');
const partnerBuild = read('scripts/build-partner-release.sh');
const partnerInputs = read('scripts/fix-partner-input-contrast-v1.mjs');
const merchantBuild = read('scripts/build-merchant-panel.mjs');

function contrast(fg, bg) {
  const rgb = (hex) => hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255);
  const luminance = (hex) => rgb(hex).map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  ).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

test('CV-005/CV-008: Motorista keeps auth and branding but not public build version', () => {
  assert.match(driver, /data-apois-partner-auth-v18/);
  assert.match(driver, /onSubmit=\{onSubmit\}/);
  assert.match(driver, /DriverGoogleLoginButton/);
  assert.match(driver, /DriverRecoveryLink/);
  assert.match(driver, /text-\[12px\] font-medium leading-relaxed text-\[#596372\]/);
  assert.doesNotMatch(driver, /<p[^>]*>APOIS Parceiro • visual 18<\/p>/);
});

test('CV-007: Passenger exposes existing typed location error without new permission calls', () => {
  assert.match(passenger, /error: locationError/);
  assert.match(passenger, /data-apois-location-error-v1="true" role="status" aria-live="polite"/);
  assert.match(passenger, /<span className="min-w-0 break-words">\{locationError\}<\/span>/);
  assert.doesNotMatch(passenger, /shadow-md">GPS<\/div>/);
  assert.match(passenger, /refreshLocation\(\); void refreshAddress\(\);/);
  assert.match(passenger, /max-h-\[38dvh\] overflow-y-auto/);
  assert.match(passenger, /<PassengerMap/);
});

test('CV-006: final Motorista placeholder overlay remains after v18', () => {
  const a = partnerBuild.indexOf('harden-partner-motorista-visual-v18.mjs');
  const b = partnerBuild.indexOf('fix-partner-input-contrast-v1.mjs" motorista');
  assert.ok(a >= 0 && b > a, 'The final scoped input overlay must run after visual v18');
  assert.match(partnerInputs, /::placeholder/);
  assert.match(partnerInputs, /#596372 !important/);
  assert.ok(contrast('#596372', '#FFFFFF') >= 4.5, 'placeholder must meet 4.5:1');
});

test('CV-007: passenger status panel contrast on pale error surface', () => {
  assert.ok(contrast('#991B1B', '#FFF1F2') >= 4.5);
});

test('CV-001/002/003/004: existing merchant corrections remain in the build chain', () => {
  const a = merchantBuild.indexOf('fix-entregas-login-accessibility-v2.mjs');
  const b = merchantBuild.indexOf('fix-entregas-login-cta-contrast-v1.mjs');
  assert.ok(a >= 0 && b > a);
  assert.match(read('scripts/fix-entregas-login-accessibility-v2.mjs'), /htmlFor="apois-login-email"/);
  assert.match(read('scripts/fix-entregas-login-cta-contrast-v1.mjs'), /WebkitTextFillColor/);
});
