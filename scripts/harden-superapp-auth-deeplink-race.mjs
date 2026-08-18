import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AUTH_DEEP_LINK_KEY = 'apois-superapp:last-auth-deeplink';

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement));
  console.log(`[OK] ${label}`);
}

replaceRequired(
  'superapp/shell/dist/index.html',
  "    function relayAuthDeepLink(rawUrl){\n      if(typeof rawUrl!=='string'||!rawUrl.startsWith('br.com.apois.app://auth/'))return false;\n      try{\n        const incoming=new URL(rawUrl);",
  `    function relayAuthDeepLink(rawUrl){\n      if(typeof rawUrl!=='string'||!rawUrl.startsWith('br.com.apois.app://auth/'))return false;\n      try{\n        const deepLinkKey=${JSON.stringify(AUTH_DEEP_LINK_KEY)};\n        try{\n          const previous=sessionStorage.getItem(deepLinkKey);\n          if(previous===rawUrl)return true;\n          sessionStorage.setItem(deepLinkKey,rawUrl);\n        }catch{}\n        const incoming=new URL(rawUrl);`,
  'shell: deep link OAuth é consumido uma única vez por sessão nativa',
);

replaceRequired(
  'superapp/shell/dist/modules/entregas/index.html',
  "  function routeAuthDeepLink(rawUrl) {\n    if (moduleName !== 'entregas' || typeof rawUrl !== 'string' || !rawUrl.startsWith('br.com.apois.app://auth/')) return false;\n    try {\n      const incoming = new URL(rawUrl);",
  `  function routeAuthDeepLink(rawUrl) {\n    if (moduleName !== 'entregas' || typeof rawUrl !== 'string' || !rawUrl.startsWith('br.com.apois.app://auth/')) return false;\n    try {\n      const deepLinkKey = ${JSON.stringify(AUTH_DEEP_LINK_KEY)};\n      try {\n        const previous = sessionStorage.getItem(deepLinkKey);\n        if (previous === rawUrl) return true;\n        sessionStorage.setItem(deepLinkKey, rawUrl);\n      } catch {}\n      const incoming = new URL(rawUrl);`,
  'entregas: appUrlOpen/getLaunchUrl não repetem callback OAuth/reset',
);

console.log('[OK] auth/deep-link race endurecida no bundle final sem alterar os apps originais');
