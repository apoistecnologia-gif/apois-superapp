import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const CANONICAL_REF = 'vqtucstyduxrqjgyigfk';
const CANONICAL_URL = `https://${CANONICAL_REF}.supabase.co`;
const HISTORICAL_REF = 'zjphbuvcapwyuynadgdt';
const root = process.cwd();
let failed = false;

function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }
function warn(message) { console.warn(`[WARN] ${message}`); }

const configuredUrl = process.env.CORRIDAS_VITE_SUPABASE_URL?.trim() || '';
const strict = process.env.APOIS_STRICT_NATIVE_CONFIG === '1';
if (!configuredUrl) {
  if (strict) fail('CORRIDAS_VITE_SUPABASE_URL é obrigatória em release estrito');
  else warn('CORRIDAS_VITE_SUPABASE_URL ausente em desenvolvimento');
} else if (configuredUrl.replace(/\/$/, '') !== CANONICAL_URL) {
  fail(`Corridas deve usar ${CANONICAL_URL}; recebido ${configuredUrl.replace(/\/$/, '')}`);
} else {
  ok(`Supabase Corridas canônico confirmado: ${CANONICAL_REF}`);
}

const configPath = resolve(root, 'sources/apois-corridas-passageiro/supabase/config.toml');
if (existsSync(configPath)) {
  const config = readFileSync(configPath, 'utf8');
  if (!config.includes(CANONICAL_REF)) fail('supabase/config.toml do snapshot não aponta para o projeto canônico');
  else ok('supabase/config.toml do snapshot aponta para o projeto canônico');
}

const TEXT_EXTENSIONS = new Set(['.ts','.tsx','.js','.jsx','.mjs','.cjs','.json','.toml','.env','.html','.css','.md','.txt','.sql']);
function scanDirectory(dir, label) {
  if (!existsSync(dir)) return;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (['node_modules','.git','.gradle'].includes(entry.name)) continue;
      const target = resolve(current, entry.name);
      if (entry.isDirectory()) { stack.push(target); continue; }
      const dot = entry.name.lastIndexOf('.');
      const ext = dot >= 0 ? entry.name.slice(dot) : '';
      if (!TEXT_EXTENSIONS.has(ext) && !entry.name.startsWith('.env')) continue;
      if (statSync(target).size > 5_000_000) continue;
      let text = '';
      try { text = readFileSync(target, 'utf8'); } catch { continue; }
      if (text.includes(HISTORICAL_REF)) fail(`${label}: referência histórica executável encontrada em ${target.slice(root.length + 1)}`);
    }
  }
}

scanDirectory(resolve(root, '.work/corridas'), 'workspace Corridas');
scanDirectory(resolve(root, '.work/corridas/dist'), 'bundle Corridas');
scanDirectory(resolve(root, 'superapp/shell/dist/modules/corridas'), 'bundle final Corridas');

if (failed) process.exit(1);
ok('Source of truth Supabase Corridas validado sem alterar o .env histórico protegido.');
