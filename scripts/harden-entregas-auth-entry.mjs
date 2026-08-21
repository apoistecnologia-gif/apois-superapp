import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const scheme = process.env.APOIS_ENTREGAS_AUTH_SCHEME || 'br.com.apois.app';
const home = process.env.APOIS_ENTREGAS_AUTH_HOME || '/inicio';

function update(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error(`[FAIL] ${label}: ${relativePath}`);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}${after === before ? ' (já aplicado)' : ''}`);
}

update(
  'src/components/GoogleLoginButton.tsx',
  (source) => {
    let next = source;
    next = next.replace(
      /const CUSTOMER_OAUTH_CALLBACK = "[^"]+";/,
      `const CUSTOMER_OAUTH_CALLBACK = "${scheme}://auth/callback";`,
    );
    next = next.replace(
      '      window.location.replace("/inicio");',
      `      window.location.replace("#${home}");`,
    );
    return next;
  },
  (source) => source.includes(`${scheme}://auth/callback`) && source.includes(`window.location.replace("#${home}")`),
  `entregas: Google OAuth retorna para ${scheme} e abre ${home}`,
);

update(
  'src/routes/login.tsx',
  (source) => {
    let next = source;
    if (!next.includes('import { GoogleLoginButton } from "@/components/GoogleLoginButton";')) {
      next = next.replace(
        'import { Input } from "@/components/ui/input";',
        'import { Input } from "@/components/ui/input";\nimport { GoogleLoginButton } from "@/components/GoogleLoginButton";',
      );
    }
    next = next.replace(
      '      redirectTo: `${window.location.origin}/redefinir-senha`,',
      `      redirectTo: "${scheme}://auth/reset",`,
    );
    if (!next.includes('data-apois-google-login-after-form')) {
      next = next.replaceAll(
        '</form>',
        '</form>\n            <div data-apois-google-login-after-form className="mt-3"><GoogleLoginButton /></div>',
      );
    }
    return next;
  },
  (source) =>
    source.includes('GoogleLoginButton') &&
    source.includes(`${scheme}://auth/reset`) &&
    source.includes('data-apois-google-login-after-form'),
  'entregas: Esqueci minha senha e Continuar com Google ficam disponíveis no login',
);

console.log(`[OK] autenticação Entregas reforçada em ${workspace}`);
