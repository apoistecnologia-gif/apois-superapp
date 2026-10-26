import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const configPath = resolve('.work/entregas/src/integrations/supabase/config.ts');
let source = readFileSync(configPath, 'utf8');

const retiredRef = 'sbvhdgyuuperszlsllji';
const canonicalRef = 'ptgkwyyolrdgnqketkjj';

const hardened = `const configuredUrl = String(import.meta.env["VITE_SUPABASE_URL"] ?? "").trim().replace(/\\/$/, "");
const configuredKey = String(import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "").trim();

if (!configuredUrl || !configuredKey) {
  throw new Error("Supabase Entregas não configurado para este build.");
}

if (configuredUrl !== "https://ptgkwyyolrdgnqketkjj.supabase.co") {
  throw new Error("Supabase Entregas inválido para o APOIS Cliente.");
}

export const SUPABASE_URL = configuredUrl;
export const SUPABASE_PUBLISHABLE_KEY = configuredKey;
`;

if (source.includes(retiredRef) || !source.includes('import.meta.env["VITE_SUPABASE_URL"]')) {
  writeFileSync(configPath, hardened, 'utf8');
  source = readFileSync(configPath, 'utf8');
}

for (const marker of [
  'import.meta.env["VITE_SUPABASE_URL"]',
  'import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"]',
  canonicalRef,
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregas Supabase runtime sem marcador: ${marker}`);
}
if (source.includes(retiredRef)) {
  throw new Error('[FAIL] Entregas Supabase runtime ainda contém o projeto aposentado.');
}

console.log('[OK] Entregas runtime consome somente Supabase de produção injetado pelo build.');
