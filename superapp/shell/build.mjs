import '../../scripts/harden-superapp-shell-auth.mjs';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const officialBranding = resolve(root, '../branding/apois-launcher.png');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(resolve(root, 'index.html'), resolve(dist, 'index.html'));

if (!existsSync(officialBranding)) {
  console.error(`[FAIL] arte oficial APOIS não existe em ${officialBranding}`);
  process.exit(1);
}
mkdirSync(resolve(dist, 'assets'), { recursive: true });
cpSync(officialBranding, resolve(dist, 'assets/apois-brand.png'));
console.log('[OK] arte oficial APOIS copiada para o shell cliente');

// Arquitetura oficial: este APK é exclusivamente do cliente.
// Motorista e Entregador pertencem ao Superapp Parceiro e não entram aqui.
const modules = [
  ['corridas', resolve(root, '../../.work/corridas/dist')],
  ['entregas', resolve(root, '../../.work/entregas/.output/public')],
];

for (const [name, source] of modules) {
  if (!existsSync(source)) {
    console.error(`[FAIL] bundle obrigatório ${name} não existe em ${source}`);
    process.exit(1);
  }
  const target = resolve(dist, 'modules', name);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`[OK] ${name} copiado para dist/modules/${name}`);
}

console.log(`[OK] shell cliente gerado em ${dist}: Corridas + Entregas`);
