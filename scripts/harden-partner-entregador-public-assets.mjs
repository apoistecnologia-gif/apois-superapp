import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';

function patch(relativePath, transform, verify, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (!verify(after)) throw new Error('[FAIL] ' + label + ': ' + relativePath);
  if (after !== before) writeFileSync(path, after, 'utf8');
  console.log('[OK] ' + label + (after === before ? ' (já aplicado)' : ''));
}

patch(
  'src/assets/logo.png.asset.json',
  (source) => source.replace('"url": "/apois-logo.svg"', '"url": "./apois-logo.svg"'),
  (source) => source.includes('"url": "./apois-logo.svg"') && !source.includes('"url": "/apois-logo.svg"'),
  'Entregador: logomarca resolve dentro do módulo aninhado',
);

patch(
  'src/components/ApoisLaunchSplash.tsx',
  (source) => source.replace('src="/apois-app-icon.png"', 'src="./apois-app-icon.png"'),
  (source) => !source.includes('src="/apois-app-icon.png"'),
  'Entregador: splash não busca ícone na raiz do host Parceiro',
);

console.log('[OK] Entregador Parceiro: assets públicos usam caminhos relativos ao módulo.');
