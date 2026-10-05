import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const CANONICAL_REF = 'ptgkwyyolrdgnqketkjj';
const CANONICAL_URL = `https://${CANONICAL_REF}.supabase.co`;
const RETIRED_REFS = ['sbvhdgyuuperszlsllji'];
const root = process.cwd();
let failed = false;
let canonicalSeen = false;

const ok = (message) => console.log(`[OK] ${message}`);
const fail = (message) => { failed = true; console.error(`[FAIL] ${message}`); };

function scan(dir, label) {
  if (!existsSync(dir)) return;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (['node_modules', '.git', '.gradle', '.github', 'docs'].includes(entry.name)) continue;
      const target = resolve(current, entry.name);
      if (entry.isDirectory()) { stack.push(target); continue; }
      if (statSync(target).size > 5_000_000) continue;
      const ext = extname(entry.name).toLowerCase();
      if (!['.js','.mjs','.cjs','.ts','.tsx','.html','.json','.css','.map','.txt'].includes(ext) && !entry.name.startsWith('.env')) continue;
      let source = '';
      try { source = readFileSync(target, 'utf8'); } catch { continue; }
      if (source.includes(CANONICAL_REF) || source.includes(CANONICAL_URL)) canonicalSeen = true;
      for (const retired of RETIRED_REFS) {
        if (source.includes(retired)) fail(`${label}: ref Supabase aposentado encontrado em ${target.slice(root.length + 1)}`);
      }
    }
  }
}

scan(resolve(root, '.work/entregas/src'), 'source runtime Entregas');
scan(resolve(root, '.work/entregas/.output/public'), 'bundle Entregas');
scan(resolve(root, 'superapp/shell/dist/modules/entregas'), 'bundle final Superapp Entregas');

if (!canonicalSeen) fail(`bundle/runtime Entregas não contém o projeto canônico ${CANONICAL_REF}`);
else ok(`Supabase Entregas canônico confirmado: ${CANONICAL_REF}`);

if (failed) process.exit(1);
ok('Entregas não contém referência executável ao projeto Supabase aposentado.');
