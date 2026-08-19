import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CORRIDAS_RECOVERY_KEY = 'apois-superapp:corridas-recovery-url';
const ENTREGAS_AUTH_FORWARD_KEY = 'apois-superapp:entregas-auth-url';

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

// Shell aberto: encaminha cada callback diretamente para o módulo dono.
replaceRequired(
  'superapp/shell/dist/index.html',
  "        const query=params.toString();\n        const suffix=query?`?${query}`:'';\n        if(path==='reset'){",
  `        const query=params.toString();\n        const suffix=query?\`?\${query}\`:'';\n        if(path==='corridas-reset'){\n          try{sessionStorage.setItem(${JSON.stringify(CORRIDAS_RECOVERY_KEY)},rawUrl);}catch{}\n          window.location.replace('./modules/corridas/index.html');\n          return true;\n        }\n        if(path==='email-change'){\n          window.location.replace(\`./modules/entregas/index.html#/perfil/dados-pessoais\${suffix}\`);\n          return true;\n        }\n        if(path==='reset'){`,
  'shell: autenticação nativa abre o módulo correto',
);

// Entregas aberto: Corridas recovery muda de módulo; os callbacks próprios ficam
// dentro de Entregas e a troca de e-mail volta ao perfil.
replaceRequired(
  'superapp/shell/dist/modules/entregas/index.html',
  "      const query = params.toString();\n      const suffix = query ? '?' + query : '';\n      if (path === 'reset') {",
  `      const query = params.toString();\n      const suffix = query ? '?' + query : '';\n      if (path === 'corridas-reset') {\n        try { sessionStorage.setItem(${JSON.stringify(CORRIDAS_RECOVERY_KEY)}, rawUrl); } catch {}\n        window.location.replace('../corridas/index.html');\n        return true;\n      }\n      if (path === 'email-change') {\n        window.location.replace('#/perfil/dados-pessoais' + suffix);\n        return true;\n      }\n      if (path === 'reset') {`,
  'entregas: callbacks próprios e recuperação de Corridas não se perdem',
);

// Corridas aberto: OAuth/reset/troca de e-mail pertencem a Entregas. O evento
// appUrlOpen ocorre apenas uma vez; guarde a URL completa antes de trocar o HTML.
replaceRequired(
  'superapp/shell/dist/modules/corridas/index.html',
  "    if (moduleName !== 'entregas' || typeof rawUrl !== 'string' || !rawUrl.startsWith('br.com.apois.app://auth/')) return false;",
  "    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('br.com.apois.app://auth/')) return false;",
  'corridas: bridge passa a reconhecer callbacks globais do package unificado',
);
replaceRequired(
  'superapp/shell/dist/modules/corridas/index.html',
  '      const params = new URLSearchParams(incoming.search);',
  `      if (moduleName === 'corridas') {\n        if (path === 'reset' || path === 'callback' || path === 'email-change') {\n          try { sessionStorage.setItem(${JSON.stringify(ENTREGAS_AUTH_FORWARD_KEY)}, rawUrl); } catch {}\n          window.location.replace('../entregas/index.html');\n          return true;\n        }\n        return false;\n      }\n      const params = new URLSearchParams(incoming.search);`,
  'corridas: callbacks de Entregas são preservados antes da troca de módulo',
);

// Quando Entregas termina de carregar, consome imediatamente o evento que foi
// preservado por Corridas. Remova antes de processar para evitar loop/replay.
replaceRequired(
  'superapp/shell/dist/modules/entregas/index.html',
  "    appPlugin.getLaunchUrl().then((result) => { if (result?.url) routeAuthDeepLink(result.url); }).catch(() => undefined);\n    appPlugin.addListener('appStateChange', ({ isActive }) => {",
  `    appPlugin.getLaunchUrl().then((result) => { if (result?.url) routeAuthDeepLink(result.url); }).catch(() => undefined);\n    try {\n      const forwardedAuthUrl = sessionStorage.getItem(${JSON.stringify(ENTREGAS_AUTH_FORWARD_KEY)});\n      if (forwardedAuthUrl) {\n        sessionStorage.removeItem(${JSON.stringify(ENTREGAS_AUTH_FORWARD_KEY)});\n        routeAuthDeepLink(forwardedAuthUrl);\n      }\n    } catch {}\n    appPlugin.addListener('appStateChange', ({ isActive }) => {`,
  'entregas: callback recebido em Corridas é consumido uma única vez',
);

console.log('[OK] deep links OAuth/reset/e-mail e recuperação de Corridas roteados entre shell, Corridas e Entregas');
