import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/dist/index.html');
let html = readFileSync(path, 'utf8');

const pendingKey = 'apois-superapp:pending-oauth-product';
const corridasForwardKey = 'apois-superapp:corridas-google-url';

if (!html.includes(corridasForwardKey)) {
  const corridasBranchPattern = /if\s*\(moduleName\s*===\s*['"]corridas['"]\)\s*\{[\s\S]*?return\s+false;\s*\}/;
  const match = html.match(corridasBranchPattern);
  if (!match) {
    throw new Error('[FAIL] corridas: branch de roteamento auth do Superapp não encontrado');
  }

  const replacement = `if (moduleName === 'corridas') {
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
        if (path === 'reset' || path === 'callback' || path === 'email-change') {
          try { sessionStorage.setItem(entregasAuthForwardKey, rawUrl); } catch {}
          window.location.replace('../entregas/index.html');
          return true;
        }
        return false;
      }`;

  html = html.replace(corridasBranchPattern, replacement);
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
