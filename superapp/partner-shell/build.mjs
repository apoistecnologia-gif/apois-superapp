import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const branding = resolve(root, '../branding/apois-launcher.png');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

if (!existsSync(branding)) {
  console.error(`[FAIL] branding APOIS ausente em ${branding}`);
  process.exit(1);
}

const templatePath = resolve(root, 'index.html');
let shellHtml = readFileSync(templatePath, 'utf8');
const brandBase64 = readFileSync(branding).toString('base64');
if (!shellHtml.includes('__APOIS_BRAND_BASE64__')) {
  console.error('[FAIL] placeholder da logo APOIS não encontrado no shell parceiro');
  process.exit(1);
}
shellHtml = shellHtml.replace('__APOIS_BRAND_BASE64__', brandBase64);
writeFileSync(resolve(dist, 'index.html'), shellHtml, 'utf8');

mkdirSync(resolve(dist, 'assets'), { recursive: true });
cpSync(branding, resolve(dist, 'assets/apois-brand.png'));
console.log('[OK] logo APOIS incorporada diretamente no shell parceiro');

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
