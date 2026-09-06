import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/dist/index.html');
let html = readFileSync(path, 'utf8');

const marker = 'data-apois-corridas-google-callback-bridge';
const inlineMarker = 'apois-superapp:corridas-google-inline-v4';
const pendingKey = 'apois-superapp:pending-oauth-product';
const corridasForwardKey = 'apois-superapp:corridas-google-url';
const callbackTtlMs = 120_000;

const inlineGuard = `
        /* ${inlineMarker} */
        if (path === 'callback') {
          try {
            const pendingRaw = localStorage.getItem('${pendingKey}');
            localStorage.removeItem('${pendingKey}');
            const pending = pendingRaw ? JSON.parse(pendingRaw) : null;
            const age = Date.now() - Number(pending?.createdAt);
            const callbackParams = new URL(rawUrl).searchParams;
            if (pending?.product === 'corridas' && age >= 0 && age <= ${callbackTtlMs} && callbackParams.get('code') && !callbackParams.has('access_token') && !callbackParams.has('refresh_token')) {
              const envelope = JSON.stringify({ url: rawUrl, createdAt: Date.now() });
              localStorage.setItem('${corridasForwardKey}', envelope);
              window.setTimeout(() => { try { if (localStorage.getItem('${corridasForwardKey}') === envelope) localStorage.removeItem('${corridasForwardKey}'); } catch { /* storage indisponível */ } }, ${callbackTtlMs});
              void browserPlugin?.close?.().catch(() => undefined);
              window.location.replace('./index.html#/login');
              return true;
            }
          } catch { /* callback inválido falha fechado */ }
        }
`;

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

if (!html.includes(marker)) {
  const bridge = `
<script ${marker}>
(() => {
  const PENDING_KEY = '${pendingKey}';
  const FORWARD_KEY = '${corridasForwardKey}';
  const appPlugin = window.Capacitor?.Plugins?.App;
  const browserPlugin = window.Capacitor?.Plugins?.Browser;

  function isSharedAuthCallback(rawUrl) {
    if (typeof rawUrl !== 'string') return false;
    try {
      const url = new URL(rawUrl);
      return url.protocol === 'br.com.apois.app:' && url.hostname === 'auth' && url.pathname === '/callback';
    } catch {
      return false;
    }
  }

  function routeCorridasGoogleCallback(rawUrl) {
    if (!isSharedAuthCallback(rawUrl)) return false;
    try {
      const pendingRaw = localStorage.getItem(PENDING_KEY);
      localStorage.removeItem(PENDING_KEY);
      const pending = pendingRaw ? JSON.parse(pendingRaw) : null;
      const age = Date.now() - Number(pending?.createdAt);
      const params = new URL(rawUrl).searchParams;
      if (pending?.product !== 'corridas' || age < 0 || age > ${callbackTtlMs} || !params.get('code') || params.has('access_token') || params.has('refresh_token')) return false;
      const envelope = JSON.stringify({ url: rawUrl, createdAt: Date.now() });
      localStorage.setItem(FORWARD_KEY, envelope);
      window.setTimeout(() => { try { if (localStorage.getItem(FORWARD_KEY) === envelope) localStorage.removeItem(FORWARD_KEY); } catch { /* storage indisponível */ } }, ${callbackTtlMs});
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
  "url.pathname === '/callback'",
  "window.location.replace('./index.html#/login')",
  'localStorage.getItem(PENDING_KEY)',
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

console.log('[OK] corridas: callback OAuth compartilhado persiste durante ciclo do Browser e não cai em Entregas');
