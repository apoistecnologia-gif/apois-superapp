import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function replaceRequired(path, search, replacement, label) {
  const full = resolve(path);
  const before = readFileSync(full, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: snapshot protegido não contém o padrão esperado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement), 'utf8');
  console.log(`[OK] ${label}`);
}

const hashAwareParams = `const hashQuery = window.location.hash.includes(\"?\")\n        ? window.location.hash.slice(window.location.hash.indexOf(\"?\") + 1)\n        : \"\";\n      const params = new URLSearchParams(hashQuery || window.location.search);`;

replaceRequired(
  '.work/entregas/src/routes/auth.callback.tsx',
  'const params = new URLSearchParams(window.location.search);',
  hashAwareParams,
  'Entregas: OAuth/confirmação/troca de e-mail lê code/next dentro do Hash Router',
);

replaceRequired(
  '.work/entregas/src/routes/redefinir-senha.tsx',
  'const params = new URLSearchParams(window.location.search);',
  hashAwareParams,
  'Entregas: recuperação de senha lê code/erro dentro do Hash Router',
);

console.log('[OK] Entregas: callbacks Supabase compatíveis com #/rota?code=... no Superapp');
