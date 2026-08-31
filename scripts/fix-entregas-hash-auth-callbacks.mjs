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
  '.work/entregas/src/routes/auth.callback.tsx',
  '      const code = params.get("code");\n      if (code) {',
  '      const accessToken = params.get("access_token");\n      const refreshToken = params.get("refresh_token");\n      if (accessToken && refreshToken) {\n        const { error } = await supabase.auth.setSession({\n          access_token: accessToken,\n          refresh_token: refreshToken,\n        });\n        if (error) {\n          if (!cancelled) setErrorMessage("Não foi possível confirmar este acesso. Solicite um novo link.");\n          return;\n        }\n      }\n\n      const code = params.get("code");\n      if (code) {',
  'Entregas: callback aplica tokens implícitos antes de consultar a sessão',
);

replaceRequired(
  '.work/entregas/src/routes/redefinir-senha.tsx',
  'const params = new URLSearchParams(window.location.search);',
  hashAwareParams,
  'Entregas: recuperação de senha lê code/erro dentro do Hash Router',
);

const loginHashAwareSearch = `const hashQuery = window.location.hash.includes(\"?\")\n          ? window.location.hash.slice(window.location.hash.indexOf(\"?\") + 1)\n          : \"\";\n        const searchParams = new URLSearchParams(hashQuery || window.location.search);`;
replaceRequired(
  '.work/entregas/src/routes/login.tsx',
  'const searchParams = new URLSearchParams(window.location.search);',
  loginHashAwareSearch,
  'Entregas: login preserva redirect seguro recebido dentro do Hash Router',
);

console.log('[OK] Entregas: parâmetros de autenticação compatíveis com #/rota?... no Superapp');
