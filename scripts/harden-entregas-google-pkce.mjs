import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, relativePath);
  const before = readFileSync(path, 'utf8');
  if (verify(before)) {
    console.log('[OK] ' + label + ' (já aplicado)');
    return;
  }
  const after = transform(before);
  if (after === before || !verify(after)) {
    throw new Error('[FAIL] ' + label + ': padrão esperado não encontrado em ' + relativePath);
  }
  writeFileSync(path, after, 'utf8');
  console.log('[OK] ' + label);
}

patch(
  `${workspace}/src/integrations/supabase/client.ts`,
  (source) => {
    let next = source;
    if (!next.includes('flowType: "pkce"')) {
      next = next.replace(
        '    detectSessionInUrl: true,',
        '    detectSessionInUrl: false,\n    flowType: "pkce",',
      );
    } else {
      next = next.replace('detectSessionInUrl: true', 'detectSessionInUrl: false');
    }
    return next;
  },
  (source) => source.includes('flowType: "pkce"') && source.includes('detectSessionInUrl: false'),
  'Entregas: Supabase OAuth usa PKCE e callback manual sem dupla troca',
);

patch(
  `${workspace}/src/routes/auth.callback.tsx`,
  (source) => {
    let next = source;
    if (!next.includes('console.error("auth callback exchange failed"')) {
      next = next.replace(
        '        const { error } = await supabase.auth.exchangeCodeForSession(code);\n        if (error) {\n          if (!cancelled)\n            setErrorMessage("Não foi possível confirmar este acesso. Solicite um novo link.");\n          return;\n        }',
        '        const { data: beforeExchange } = await supabase.auth.getSession();\n        if (!beforeExchange.session) {\n          const { error } = await supabase.auth.exchangeCodeForSession(code);\n          if (error) {\n            console.error("auth callback exchange failed", error);\n            const { data: current } = await supabase.auth.getSession();\n            if (!current.session) {\n              if (!cancelled) setErrorMessage("Não foi possível confirmar este acesso. Tente entrar novamente.");\n              return;\n            }\n          }\n        }',
      );
    }
    return next;
  },
  (source) =>
    source.includes('const { data: beforeExchange } = await supabase.auth.getSession();') &&
    source.includes('if (!beforeExchange.session)') &&
    source.includes('console.error("auth callback exchange failed"') &&
    source.includes('if (!current.session)'),
  'Entregas: callback preserva sessão já criada e não falha por troca duplicada',
);

console.log(`[OK] Entregas: Google OAuth PKCE endurecido em ${workspace}.`);
