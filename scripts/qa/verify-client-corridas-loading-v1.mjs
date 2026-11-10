// APOIS_CLIENT_CORRIDAS_LOADING_BRAND_V1 — inspect the actual packaged HTML.
// A failed assertion blocks APK publication without touching auth/maps/routes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const file = resolve(process.argv[2] || 'superapp/shell/dist/modules/corridas/index.html');
const html = readFileSync(file, 'utf8');
const marker = 'data-apois-client-loading-v1';
assert.equal(html.split(marker).length - 1, 1, 'Corridas startup loader must be branded exactly once');
assert.equal(html.split('id="apois-fallback-loading"').length - 1, 1, 'Keep exactly one fallback inside React root');
const from = html.indexOf('id="apois-fallback-loading"');
const to = html.indexOf('</div>', from);
assert.ok(from >= 0 && to > from, 'Corridas fallback unavailable in final HTML');
const fallback = html.slice(from, to);
for (const requirement of [
  'role="status"', 'aria-live="polite"', 'background:#F7F7F8',
  'color:#C9141B', 'Carregando APOIS...', 'min-height:100dvh',
  'width="104"', 'height="104"', 'alt="APOIS"',
]) assert.ok(fallback.includes(requirement), 'Unbranded Corridas loader: ' + requirement);
assert.ok(!/background:\s*(?:black|#000)\b|#ffb800|#F6BE1C/i.test(fallback), 'Legacy black/yellow loader survived');
const logo = fallback.match(/<img src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/);
assert.ok(logo, 'Official APOIS logo must be embedded without a startup network request');
const bytes = Buffer.from(logo[1], 'base64');
assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Embedded image must be PNG');
assert.equal(bytes.readUInt32BE(16), 128, 'Unexpected official brand width');
assert.equal(bytes.readUInt32BE(20), 128, 'Unexpected official brand height');
assert.ok(html.includes('id="root"'), 'React root missing');
assert.match(html, /<script\b[^>]*src="[^"]+\.js"[^>]*><\/script>/, 'React entrypoint missing');
assert.ok(html.includes('data-apois-superapp-bridge'), 'Preserve Corridas routing/session bridge');
assert.ok(html.includes('apois-superapp-module-bridge'), 'Preserve selector button/return to other services');
console.log('[OK] APK Cliente Corridas: loading screen white/red with embedded APOIS PNG; React and bridges intact');
