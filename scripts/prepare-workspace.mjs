import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(resolve(root, '.apois/modules.json'), 'utf8'));
const selected = process.argv.slice(2);
const names = selected.length ? selected : Object.keys(manifest.modules);

for (const name of names) {
  const config = manifest.modules[name];
  if (!config) {
    console.error(`Módulo desconhecido: ${name}`);
    process.exitCode = 1;
    continue;
  }

  const source = resolve(root, config.source);
  const workspace = resolve(root, config.workspace);
  if (!existsSync(source)) {
    console.error(`[FAIL] ${name}: fonte não inicializada em ${config.source}`);
    console.error('Execute: git submodule update --init --recursive');
    process.exitCode = 1;
    continue;
  }

  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(dirname(workspace), { recursive: true });
  cpSync(source, workspace, {
    recursive: true,
    filter: (src) => !src.includes('/.git/') && !src.endsWith('/.git') && !src.includes('/node_modules/'),
  });
  console.log(`[OK] ${name}: snapshot copiado para ${config.workspace}`);
}
