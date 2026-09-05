import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/dist/index.html');
let html = readFileSync(path, 'utf8');

const marker = 'data-apois-corridas-google-callback-bridge';
const inlineMarker = 'apois-superapp:corridas-google-inline-v2';
const pendingKey = 'apois-superapp:pending-oauth-product';
const corridasForwardKey = 'apois-superapp:corridas-google-url';

// Corrige o bridge já injetado pelo build-isolated-module ANTES de registrar
// listeners adicionais. Assim o callback compartilhado de Corridas não pode ser
// encaminhado para Entregas por uma corrida entre listeners appUrlOpen.
if (!html.includes(inlineMarker)) {
  const branchAnchor = "if (moduleName === 'corridas') {";
  const anchorIndex = html.indexOf(branchAnchor);
  if (anchorIndex < 0) {
    throw new Error('[FAIL] corridas: branch base de auth do Superapp não encontrada');
  }
  const insertAt = anchorIndex + branchAnchor.length;
  const inlineGuard = `
        /* ${inlineMarker} */
        if (path === 'callback') {
          try {
            const pendingProduct = sessionStorage.getItem('${pendingKey}');
            if (pendingProduct === 'corridas') {
              sessionStorage.removeItem('${pendingKey}');
              sessionStorage.setItem('${corridasForwardKey}', rawUrl);
              void browserPlugin?.close?.().catch(() => undefined);
              window.location.replace('./index.html#/login');
              return true;
            }
          } catch {}
        }
`;
  html = html.slice(0, insertAt) + inlineGuard + html.slice(insertAt);
}

// Listener standalone permanece como defesa em profundidade para callbacks
// recebidos quando o bridge base ainda não terminou o bootstrap.
if (!html.includes(marker)) {
  const bridge = `
<script ${marker}>
(() => {
  const PENDING_KEY = '${pendingKey}';
  const FORWARD_KEY = '${corridasForwardKey}';
  const appPlugin = window.Capacitor?.Plugins?.App;
  const browserPlugin = window.Capacitor?.Plugins?.Browser;

  function isSharedAuthCallback(rawUrl) {
    return typeof rawUrl === 'string' && rawUrl.startsWith('br.com.apois.app://auth/callback');
  }

  function routeCorridasGoogleCallback(rawUrl) {
    if (!isSharedAuthCallback(rawUrl)) return false;
    try {
      const pendingProduct = sessionStorage.getItem(PENDING_KEY);
      if (pendingProduct !== 'corridas') return false;
      sessionStorage.removeItem(PENDING_KEY);
      sessionStorage.setItem(FORWARD_KEY, rawUrl);
    } catch {
      return false;
    }
    void browserPlugin?.close?.().catch(() => undefined);
    window.location.replace('./index.html#/login');
    return true;
  }

  if (appPlugin) {
    Promise.resolve(appPlugin.addListener('appUrlOpen', ({ url }) => {
      routeCorridasGoogleCallback(url);
    })).catch(() => undefined);
    Promise.resolve(appPlugin.getLaunchUrl()).then((result) => {
      if (result?.url) routeCorridasGoogleCallback(result.url);
    }).catch(() => undefined);
  }
})();
</script>`;

  html = html.includes('</body>')
    ? html.replace('</body>', `${bridge}\n</body>`)
    : `${html}\n${bridge}\n`;
}

writeFileSync(path, html, 'utf8');

for (const required of [
  inlineMarker,
  marker,
  pendingKey,
  corridasForwardKey,
  'br.com.apois.app://auth/callback',
  "pendingProduct === 'corridas'",
  "window.location.replace('./index.html#/login')",
]) {
  if (!html.includes(required)) {
    throw new Error(`[FAIL] corridas: callback Google compartilhado incompleto (${required})`);
  }
}

console.log('[OK] corridas: callback OAuth compartilhado é consumido antes do encaminhamento para Entregas');
