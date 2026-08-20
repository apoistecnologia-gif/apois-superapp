import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const branding = resolve(root, '../branding/apois-launcher.png');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(resolve(root, 'index.html'), resolve(dist, 'index.html'));

if (!existsSync(branding)) {
  console.error(`[FAIL] branding APOIS ausente em ${branding}`);
  process.exit(1);
}
mkdirSync(resolve(dist, 'assets'), { recursive: true });
cpSync(branding, resolve(dist, 'assets/apois-brand.png'));

const modules = [
  ['motorista', resolve(root, '../../.work/partner-motorista/dist/client')],
  ['entregador', resolve(root, '../../.work/partner-entregador/.output/public')],
];

for (const [name, source] of modules) {
  if (!existsSync(source)) {
    console.error(`[FAIL] bundle parceiro ${name} ausente em ${source}`);
    process.exit(1);
  }
  const target = resolve(dist, 'modules', name);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`[OK] ${name} copiado para o APOIS Parceiro`);
}

console.log('[OK] APOIS Parceiro gerado: Motorista + Entregador');
