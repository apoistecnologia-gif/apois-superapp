// Auditoria estatica sem Google Maps API requests e sem build Android.
// Impede mapas divergentes e regressao de paleta, rota, login e safe areas.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APOIS_MAP_BACKGROUND, APOIS_MAP_ROUTE, APOIS_MAP_RULES, APOIS_MAP_WATER, assertApoisMapPalette, mapStyleDeclaration } from './apois-map-palette.mjs';
const read=(path)=>readFileSync(path,'utf8');
assertApoisMapPalette(APOIS_MAP_RULES);
assert.ok(APOIS_MAP_RULES.length >= 20);
assert.equal(APOIS_MAP_WATER, '#0B2944');
assert.equal(APOIS_MAP_ROUTE, '#E51B23');
assert.equal(APOIS_MAP_BACKGROUND, '#EDEAE4');
assert.ok(mapStyleDeclaration('APOIS_TEST_STYLE').includes('"#0B2944"'));
const passenger = read('scripts/harden-corridas-native-map.mjs');
const driver = read('scripts/harden-motorista-map-branding.mjs');
const buildPassenger = read('scripts/build-isolated-module.mjs');
const buildDriver = read('scripts/build-partner-release.sh');
const partnerVisual = read('scripts/harden-partner-motorista-visual-v18.mjs');
const partnerShell = read('superapp/partner-shell/index.html');
for (const marker of [
  "mapStyleDeclaration('APOIS_MAP_STYLE_LIGHT_NATIVE')",
  "mapStyleDeclaration('APOIS_PASSENGER_MAP_STYLE_V3')",
  'styles: APOIS_PASSENGER_MAP_STYLE_V3,',
  "APOIS_MAP_ROUTE",
  'strokeColor: ROUTE_CONFIG.STYLE.STROKE_COLOR,',
]) {
  if (marker.includes('strokeColor: ROUTE_CONFIG')) {
    // The old route color is intentionally replaced by the hardener, not used.
    assert.ok(passenger.includes("'strokeColor: ROUTE_CONFIG.STYLE.STROKE_COLOR,'"));
  } else assert.ok(passenger.includes(marker), 'Passageiro V3 sem '+marker);
}
for(const marker of [
  "mapStyleDeclaration('APOIS_LIGHT_MAP_STYLE'",
  "APOIS_MAP_BACKGROUND",
  "APOIS_DRIVER_LOCATION_V2",
  'themeOverride="light"',
  "rotation: displayHeading",
]) assert.ok(driver.includes(marker),'Motorista V3 sem '+marker);
assert.ok(buildPassenger.includes("'scripts/harden-corridas-native-map.mjs'"));
assert.ok(buildDriver.includes('scripts/harden-motorista-map-branding.mjs'));
assert.ok(partnerVisual.includes('APOIS_LOGIN_INPUT_CONTRAST_V19'));
assert.ok(partnerShell.includes('APOIS Partner mobile-fit V19'));
assert.ok(partnerShell.includes('overflow-y:auto'));
assert.ok(partnerShell.includes('max(24px,env(safe-area-inset-bottom))'));
console.log('[OK] APOIS Maps V3: ambos partilham paleta, agua azul-marinho, rotas vermelhas, GPS preservado e UX Parceiro protegida.');
