import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/dist/index.html');
let html = readFileSync(path, 'utf8');

const marker = 'data-apois-corridas-google-callback-bridge';
const inlineMarker = 'apois-superapp:corridas-google-inline-v3';
const pendingKey = 'apois-superapp:pending-oauth-product';
const corridasForwardKey = 'apois-superapp:corridas-google-url';

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

// O bridge do módulo pode vir do snapshot ou do build-isolated-module e já mudou
// de formatação ao longo dos pins. Em vez de depender da linha
// "if (moduleName === 'corridas')", endurecemos o ponto de encaminhamento real
// para Entregas. Se esse encaminhamento existir, o callback compartilhado de
// Corridas precisa ser consumido imediatamente antes dele.
if (!html.includes(inlineMarker)) {
  const forwardingBlock = /if\s*\(\s*path\s*===\s*['"]reset['"]\s*\|\|\s*path\s*===\s*['"]callback['"]\s*\|\|\s*path\s*===\s*['"]email-change['"]\s*\)\s*\{/;
  const forwardingMatch = forwardingBlock.exec(html);

  if (forwardingMatch?.index >= 0) {
    html = html.slice(0, forwardingMatch.index) + inlineGuard + html.slice(forwardingMatch.index);
  } else {
    const appearsToForwardToEntregas =
      html.includes('entregasAuthForwardKey') &&
      html.includes('../entregas/index.html') &&
      html.includes("path === 'callback'");

    if (appearsToForwardToEntregas) {
      throw new Error('[FAIL] corridas: encaminhamento auth para Entregas existe, mas formato não foi reconhecido com segurança');
    }
  }
}

// Listener standalone permanece como defesa em profundidade. Ele cobre bundles
// que não possuem o bridge de encaminhamento acima e também callbacks recebidos
// antes da inicialização completa da tela React.
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
  marker,
  pendingKey,
  corridasForwardKey,
  'br.com.apois.app://auth/callback',
  "window.location.replace('./index.html#/login')",
]) {
  if (!html.includes(required)) {
    throw new Error(`[FAIL] corridas: callback Google compartilhado incompleto (${required})`);
  }
}

const stillForwardsSharedCallbackToEntregas =
  html.includes('entregasAuthForwardKey') &&
  html.includes('../entregas/index.html') &&
  html.includes("path === 'callback'");

if (stillForwardsSharedCallbackToEntregas && !html.includes(inlineMarker)) {
  throw new Error('[FAIL] corridas: callback compartilhado ainda pode ser encaminhado para Entregas antes de ser consumido');
}

console.log('[OK] corridas: callback OAuth compartilhado endurecido sem depender de branch/whitespace do HTML');
