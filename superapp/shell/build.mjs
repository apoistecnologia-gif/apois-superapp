import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(resolve(root, 'index.html'), resolve(dist, 'index.html'));

const modules = [
  ['corridas', resolve(root, '../../.work/corridas/dist')],
  ['entregas', resolve(root, '../../.work/entregas/.output/public')],
];

for (const [name, source] of modules) {
  if (!existsSync(source)) {
    console.warn(`[WARN] bundle ${name} ainda não existe em ${source}`);
    continue;
  }
  const target = resolve(dist, 'modules', name);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`[OK] ${name} copiado para dist/modules/${name}`);
}

console.log(`[OK] shell gerado em ${dist}`);
