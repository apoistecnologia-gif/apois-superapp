import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FORWARDED_RECOVERY_KEY = 'apois-superapp:corridas-recovery-url';

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
  "        const query=params.toString();\n        const suffix=query?`?${query}`:'';\n        if(path==='reset'){",
  `        const query=params.toString();\n        const suffix=query?\`?\${query}\`:'';\n        if(path==='corridas-reset'){\n          try{sessionStorage.setItem(${JSON.stringify(FORWARDED_RECOVERY_KEY)},rawUrl);}catch{}\n          window.location.replace('./modules/corridas/index.html');\n          return true;\n        }\n        if(path==='reset'){`,
  'shell: recuperação de senha de Corridas abre o módulo correto',
);

replaceRequired(
  'superapp/shell/dist/modules/entregas/index.html',
  "      const query = params.toString();\n      const suffix = query ? '?' + query : '';\n      if (path === 'reset') {",
  `      const query = params.toString();\n      const suffix = query ? '?' + query : '';\n      if (path === 'corridas-reset') {\n        try { sessionStorage.setItem(${JSON.stringify(FORWARDED_RECOVERY_KEY)}, rawUrl); } catch {}\n        window.location.replace('../corridas/index.html');\n        return true;\n      }\n      if (path === 'reset') {`,
  'entregas: deep link de recuperação de Corridas troca para o módulo correto',
);

console.log('[OK] deep link de recuperação de Corridas roteado pelo Superapp sem expor credenciais em logs');
