import { cpSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const workspace = resolve(root, '.work/admin');
const output = resolve(root, '.output');

function run(bin, args, cwd = root, env = process.env) {
  const r = spawnSync(bin, args, { cwd, stdio: 'inherit', env });
  if (r.error) throw r.error;
  if (r.status !== 0) process.exit(r.status ?? 1);
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

const env = {
  ...process.env,
  VITE_SUPABASE_URL: url,
  VITE_SUPABASE_PUBLISHABLE_KEY: key,
  NITRO_PRESET: 'vercel',
};

run('bun', ['install', '--frozen-lockfile'], workspace, env);
run('bun', ['run', 'typecheck'], workspace, env);
run('bun', ['run', 'build'], workspace, env);

const built = resolve(workspace, '.output');
if (!existsSync(built)) {
  console.error('[FAIL] Admin Corridas: .output não foi gerado');
  process.exit(1);
}
rmSync(output, { recursive: true, force: true });
cpSync(built, output, { recursive: true });

console.log('[OK] Admin Corridas: build Vercel preparado em .output');
