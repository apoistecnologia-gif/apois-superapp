import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] endereço runtime: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireAll(path, markers, label) {
  const source = read(path);
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}
function forbidAll(path, markers, label) {
  const source = read(path);
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

for (const path of [
  '.work/entregas/src/components/CustomerLocationAddressSelector.tsx',
  '.work/entregas/src/components/GoogleMapsAddressSelector.tsx',
]) {
  requireAll(path, [
    'import { Geolocation } from "@capacitor/geolocation";',
    'await Geolocation.checkPermissions()',
    'await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] })',
    'await Geolocation.getCurrentPosition({',
  ], `${path}: usa Geolocation nativo`);
  forbidAll(path, ['navigator.geolocation'], `${path}: não depende de navigator.geolocation`);
}

requireAll('.work/entregas/src/components/GoogleMapsAddressSelector.tsx', [
  'supabase.functions.invoke("google-maps-address", { body })',
  'action: "reverse_geocode"',
  'action: "autocomplete"',
  'action: "place_details"',
], 'mapa de edição usa Edge Function implantada no APK');
forbidAll('.work/entregas/src/components/GoogleMapsAddressSelector.tsx', [
  'useServerFn(',
  '@/lib/google-maps.functions',
  'getAccessToken()',
], 'mapa de edição não depende de servidor TanStack inexistente no APK');

process.exit(failed ? 1 : 0);
