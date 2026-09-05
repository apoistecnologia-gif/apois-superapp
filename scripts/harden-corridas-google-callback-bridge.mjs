import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/dist/index.html');
let html = readFileSync(path, 'utf8');

const pendingKey = 'apois-superapp:pending-oauth-product';
const corridasForwardKey = 'apois-superapp:corridas-google-url';

if (!html.includes(corridasForwardKey)) {
  const anchor = "if (path === 'reset' || path === 'callback' || path === 'email-change') {";
  const anchorIndex = html.indexOf(anchor);
  if (anchorIndex < 0) {
    throw new Error('[FAIL] corridas: roteamento de callback auth do Superapp não encontrado');
  }

  const callbackBlock = `if (path === 'callback') {
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

  html = html.slice(0, anchorIndex) + callbackBlock + html.slice(anchorIndex);
  writeFileSync(path, html, 'utf8');
}

for (const marker of [
  pendingKey,
  corridasForwardKey,
  "pendingProduct === 'corridas'",
  "window.location.replace('./index.html#/login')",
]) {
  if (!html.includes(marker)) {
    throw new Error(`[FAIL] corridas: callback Google compartilhado incompleto (${marker})`);
  }
}

console.log('[OK] corridas: callback OAuth compartilhado retorna ao módulo Corridas');
