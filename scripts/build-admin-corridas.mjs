import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const workspace = resolve(root, '.work/admin');
const output = resolve(root, '.vercel/output');

function run(bin, args, cwd = root, env = process.env) {
  const r = spawnSync(bin, args, { cwd, stdio: 'inherit', env });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (!existsSync(resolve(root, 'sources/apois-corridas-motorista-admin/package.json'))) {
  const token = process.env.APOIS_CORRIDAS_ADMIN_SUBMODULE_TOKEN?.trim()
    || process.env.APOIS_GITHUB_SUBMODULE_TOKEN?.trim();
  if (!token) {
    console.error('[FAIL] sources/apois-corridas-motorista-admin não foi inicializado no checkout.');
    console.error('Defina APOIS_CORRIDAS_ADMIN_SUBMODULE_TOKEN na Vercel com leitura em franciel046631/movvi-go-connect.');
    process.exit(1);
  }
  console.log('[INFO] Inicializando submódulo Motorista/Admin com token dedicado...');
  const authHeader = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`;
  run('git', [
    '-c',
    `http.https://github.com/.extraheader=${authHeader}`,
    'submodule',
    'update',
    '--init',
    '--recursive',
    'sources/apois-corridas-motorista-admin',
  ]);
  if (!existsSync(resolve(root, 'sources/apois-corridas-motorista-admin/package.json'))) {
    console.error('[FAIL] Falha ao inicializar sources/apois-corridas-motorista-admin mesmo com token configurado.');
    process.exit(1);
  }
}

const url = process.env.VITE_SUPABASE_URL?.trim() || process.env.CORRIDAS_VITE_SUPABASE_URL?.trim();
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !key) {
  console.error('[FAIL] Admin Corridas: VITE_SUPABASE_URL/PUBLISHABLE_KEY ausentes');
  process.exit(1);
}
if (!url.includes('tbbzkrfupmqdywnzgnms.supabase.co')) {
  console.error('[FAIL] Admin Corridas: Supabase informado não é o projeto Corridas canônico');
  process.exit(1);
}

run(process.execPath, [resolve(root, 'scripts/prepare-workspace.mjs'), 'admin']);
run(process.execPath, [resolve(root, 'scripts/harden-admin-motorista-safe2pay-onboarding.mjs')], root, {
  ...process.env,
  APOIS_ADMIN_WORKSPACE: '.work/admin',
});
run(process.execPath, [resolve(root, 'scripts/apply-apois-brand-v2.mjs'), 'admin'], root, {
  ...process.env,
  APOIS_ADMIN_WORKSPACE: '.work/admin',
});

const env = {
  ...process.env,
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PUBLISHABLE_KEY: key,
  NITRO_PRESET: 'vercel',
};

const frozenInstall = spawnSync('bun', ['install', '--frozen-lockfile'], {
  cwd: workspace,
  stdio: 'inherit',
  env,
});
if (frozenInstall.error) throw frozenInstall.error;
if (frozenInstall.status !== 0) {
  console.warn('[WARN] Admin Corridas: bun.lock do pin não é reproduzível com Bun atual; usando instalação --no-save somente em .work/admin.');
  run('bun', ['install', '--no-save'], workspace, env);
}
run(process.execPath, [resolve(root, 'scripts/audit-apois-brand-v2.mjs')], root, env);
run('bun', ['run', 'typecheck'], workspace, env);
run('bun', ['run', 'build'], workspace, env);

const built = resolve(workspace, '.vercel/output');
if (!existsSync(built)) {
  console.error('[FAIL] Admin Corridas: .vercel/output não foi gerado');
  process.exit(1);
}
rmSync(resolve(root, '.vercel'), { recursive: true, force: true });
cpSync(built, output, { recursive: true });

console.log('[OK] Admin Corridas: Build Output API preparado em .vercel/output');
