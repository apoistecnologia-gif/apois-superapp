import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(process.cwd(), workspace, 'src/routes/login.tsx');
let source = readFileSync(path, 'utf8');

const marker = 'APOIS_COURIER_LOGIN_LOGO_RELATIVE_V1';

if (!source.includes(marker)) {
  source = source.replace(
    'import logoAsset from "@/assets/logo.png.asset.json";\n',
    '',
  );

  source = source.replace(
    '              src={logoAsset.url}\n              alt="APOIS ENTREGA"',
    '              src="./apois-logo.svg"\n              alt="APOIS ENTREGA"\n              data-apois-courier-logo="' + marker + '"',
  );

  source = source.replace(
    '            src={logoAsset.url}\n            alt="APOIS ENTREGA"',
    '            src="./apois-logo.svg"\n            alt="APOIS ENTREGA"\n            data-apois-courier-logo="' + marker + '"',
  );
}

if (!source.includes('src="./apois-logo.svg"') || !source.includes(marker)) {
  throw new Error('[FAIL] Entregador: logo relativo do login não foi aplicado');
}

if (source.includes('logoAsset.url')) {
  throw new Error('[FAIL] Entregador: login ainda depende de logoAsset.url absoluto');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador: login usa logo APOIS relativo ao módulo aninhado.');
