import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, '.apois/modules.json'), 'utf8'));
const name = process.argv[2];

if (!name || !manifest.modules[name]) {
  console.error(`Uso: node scripts/build-isolated-module.mjs <${Object.keys(manifest.modules).join('|')}>`);
  process.exit(1);
}

const prepare = spawnSync(process.execPath, [resolve(root, 'scripts/prepare-workspace.mjs'), name], {
  cwd: root,
  stdio: 'inherit',
});
if (prepare.status !== 0) process.exit(prepare.status ?? 1);

const config = manifest.modules[name];
const cwd = resolve(root, config.workspace);

for (const command of [config.install, config.build]) {
  const [bin, ...args] = command;
  const result = spawnSync(bin, args, { cwd, stdio: 'inherit', env: process.env });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`[OK] ${name}: build isolado concluído em ${config.workspace}`);
