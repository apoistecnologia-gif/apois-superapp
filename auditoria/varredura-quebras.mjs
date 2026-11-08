// Varredura estática de "coisas que impedem o app de funcionar".
// Compara o que as telas PEDEM com o que o backend/config OFERECE.
// Não altera nada. Saída: JSON com achados por categoria.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === 'dist' || e === '.output') continue;
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, exts, out);
    else if (exts.some(x => e.endsWith(x))) out.push(p);
  }
  return out;
}
const read = p => readFileSync(p, 'utf8');
const lineOf = (src, idx) => src.slice(0, idx).split('\n').length;

const PRODUCTS = [
  { name: 'Entregas', src: 'sources/apois-entregas/src', fns: ['sources/apois-entregas/supabase/functions', 'supabase/functions'], mig: ['sources/apois-entregas/supabase/migrations'], routes: 'sources/apois-entregas/src/routes' },
  { name: 'Corridas-Passageiro', src: 'sources/apois-corridas-passageiro/src', fns: ['sources/apois-corridas-passageiro/supabase/functions', 'supabase/functions'], mig: ['sources/apois-corridas-passageiro/supabase/migrations', 'sources/apois-corridas-motorista-admin/supabase/migrations'], routes: 'sources/apois-corridas-passageiro/src/routes' },
  { name: 'Motorista-Admin', src: 'sources/apois-corridas-motorista-admin/src', fns: ['sources/apois-corridas-motorista-admin/supabase/functions', 'sources/apois-corridas-passageiro/supabase/functions', 'supabase/functions'], mig: ['sources/apois-corridas-motorista-admin/supabase/migrations', 'sources/apois-corridas-passageiro/supabase/migrations'], routes: 'sources/apois-corridas-motorista-admin/src/routes' },
];

const result = {};
for (const P of PRODUCTS) {
  const files = walk(P.src, ['.ts', '.tsx']);
  const fnDirs = new Set(P.fns.flatMap(d => existsSync(d) ? readdirSync(d).filter(x => !x.startsWith('_')) : []));
  const migSrc = P.mig.flatMap(d => walk(d, ['.sql'])).map(read).join('\n');
  const rpcDefined = new Set([...migSrc.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?"?([a-z0-9_]+)"?/gi)].map(m => m[1].toLowerCase()));
  const tablesDefined = new Set([...migSrc.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)].map(m => m[1].toLowerCase()));
  const viewsDefined = new Set([...migSrc.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?"?([a-z0-9_]+)"?/gi)].map(m => m[1].toLowerCase()));
  const bucketsDefined = new Set([...migSrc.matchAll(/storage\.buckets[^;]*?values\s*\(\s*'([a-z0-9_-]+)'/gi)].map(m => m[1]));
  const routeFiles = walk(P.routes, ['.tsx']).map(f => relative(P.routes, f).replace(/\\/g, '/'));

  const r = { edgeMissing: [], rpcMissing: [], tableMissing: [], bucketMissing: [], navMissing: [], envUsed: new Set(), movvi: [], contrast: [], oversized: [], vh: [], uploadsWithoutBucket: [] };

  // rota existente? converte arquivo -> padrão de caminho
  const routePaths = routeFiles.map(f => '/' + f.replace(/\.tsx$/, '').replace(/^_[a-z]+\./, '').replace(/\/index$/, '').replace(/\./g, '/').replace(/^index$/, '').replace(/__root|README/, ''));
  const routeExists = to => {
    const t = to.split(/[?#]/)[0].replace(/\/$/, '') || '/';
    if (t === '/') return true;
    return routePaths.some(p => {
      const re = new RegExp('^' + p.replace(/\$[A-Za-z]+/g, '[^/]+').replace(/\/$/, '') + '$');
      return re.test(t) || re.test(t.replace(/\/[^/]+$/, '/$x'));
    });
  };

  for (const f of files) {
    const s = read(f);
    const rel = relative('.', f).replace(/\\/g, '/');
    for (const m of s.matchAll(/functions\.invoke\(\s*["'`]([A-Za-z0-9_-]+)/g)) if (!fnDirs.has(m[1])) r.edgeMissing.push({ fn: m[1], at: `${rel}:${lineOf(s, m.index)}` });
    for (const m of s.matchAll(/\.rpc\(\s*["'`]([A-Za-z0-9_]+)/g)) if (!rpcDefined.has(m[1].toLowerCase())) r.rpcMissing.push({ rpc: m[1], at: `${rel}:${lineOf(s, m.index)}` });
    for (const m of s.matchAll(/\.from\(\s*["'`]([a-z0-9_]+)["'`]/g)) {
      const t = m[1].toLowerCase();
      if (s.slice(Math.max(0, m.index - 12), m.index).includes('storage')) continue;
      if (!tablesDefined.has(t) && !viewsDefined.has(t)) r.tableMissing.push({ table: t, at: `${rel}:${lineOf(s, m.index)}` });
    }
    for (const m of s.matchAll(/storage\s*\.from\(\s*["'`]([a-z0-9_-]+)/g)) if (!bucketsDefined.has(m[1])) r.bucketMissing.push({ bucket: m[1], at: `${rel}:${lineOf(s, m.index)}` });
    for (const m of s.matchAll(/(?:navigate\(\{\s*to:\s*|to=)["'`](\/[^"'`$]*)["'`]/g)) if (!routeExists(m[1])) r.navMissing.push({ to: m[1], at: `${rel}:${lineOf(s, m.index)}` });
    for (const m of s.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) r.envUsed.add(m[1]);
    for (const m of s.matchAll(/MOVVI/g)) r.movvi.push(`${rel}:${lineOf(s, m.index)}`);
    for (const m of s.matchAll(/className=["'`][^"'`]*\b(text-black[^"'`]*bg-black|bg-black[^"'`]*text-black|text-white[^"'`]*bg-white\b|bg-white\b[^"'`]*text-white)[^"'`]*["'`]/g)) r.contrast.push({ cls: m[1].slice(0, 60), at: `${rel}:${lineOf(s, m.index)}` });
    for (const m of s.matchAll(/\b(?:w|min-w)-\[(\d{3,4})px\]/g)) if (Number(m[1]) > 400) r.oversized.push({ cls: m[0], at: `${rel}:${lineOf(s, m.index)}` });
    for (const m of s.matchAll(/\b(?:h|min-h)-screen\b|100vh/g)) r.vh.push(`${rel}:${lineOf(s, m.index)}`);
    if (/type=["']file["']/.test(s) && !/storage\s*\.from|functions\.invoke|upload/i.test(s)) r.uploadsWithoutBucket.push(rel);
  }
  r.envUsed = [...r.envUsed];
  r.counts = { files: files.length, fnDirs: fnDirs.size, rpcDefined: rpcDefined.size, tablesDefined: tablesDefined.size, buckets: [...bucketsDefined] };
  result[P.name] = r;
}
const envExample = existsSync('.env.example') ? read('.env.example') : '';
for (const k of Object.keys(result)) result[k].envUndocumented = result[k].envUsed.filter(v => !envExample.includes(v) && !['DEV', 'PROD', 'MODE', 'SSR', 'BASE_URL'].includes(v));
console.log(JSON.stringify(result));
