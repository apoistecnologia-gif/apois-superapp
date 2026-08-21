import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';
const loginPath = resolve(root, workspace, 'src/routes/motorista.login.tsx');

let source = readFileSync(loginPath, 'utf8');

const aliasPattern = /\nconst DriverRecoveryLink = Link as unknown as \(props: \{[\s\S]*?\n\}\) => React\.ReactElement;\n/;
if (aliasPattern.test(source)) {
  source = source.replace(aliasPattern, '\n');
}

const brokenRecoveryLink = '<div className="flex justify-end"><DriverRecoveryLink to="/motorista/recuperar-senha" className="inline-flex min-h-11 items-center px-2 py-2 text-[12px] font-black text-[#F6BE1C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6BE1C]">Esqueci minha senha</DriverRecoveryLink></div>';
if (source.includes(brokenRecoveryLink)) {
  source = source.replace(brokenRecoveryLink, '');
}

if (source.includes('/motorista/recuperar-senha') || source.includes('DriverRecoveryLink')) {
  console.error('[FAIL] motorista: referência à rota inexistente /motorista/recuperar-senha ainda presente');
  process.exit(1);
}

writeFileSync(loginPath, source, 'utf8');
console.log('[OK] motorista: botão que apontava para rota inexistente removido do build');
