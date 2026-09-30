import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const configPath = resolve(root, workspace, 'src/integrations/supabase/config.ts');
let source = readFileSync(configPath, 'utf8');

const replacement = `const runtimeUrl = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").trim();
const runtimeKey = String(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "").trim();

if (!runtimeUrl || !runtimeKey) {
  throw new Error("Supabase Entregas não configurado no build");
}

export const SUPABASE_URL = runtimeUrl;
export const SUPABASE_PUBLISHABLE_KEY = runtimeKey;
`;

if (!source.includes('import.meta.env["VITE_SUPABASE_URL"]')) {
  source = replacement;
}

if (source.includes('sbvhdgyuuperszlsllji.supabase.co')) {
  throw new Error('[FAIL] Entregador: config Supabase aposentada permaneceu no workspace');
}
if (!source.includes('import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]')) {
  throw new Error('[FAIL] Entregador: config não usa publishable key de release');
}

writeFileSync(configPath, source, 'utf8');
console.log('[OK] Entregador: config Supabase passa a usar somente variáveis de release.');
