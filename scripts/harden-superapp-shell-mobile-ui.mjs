import './harden-superapp-shell-iconography.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(process.env.APOIS_SHELL_HTML_PATH?.trim() || 'superapp/shell/index.html');
let source = readFileSync(path, 'utf8');

source = source.replace(
  'body{min-height:100dvh;overflow-x:hidden}',
  'body{min-height:100dvh;overflow-x:hidden;overflow-y:auto}',
);
source = source.replace(
  'padding:max(env(safe-area-inset-top),18px) 16px max(env(safe-area-inset-bottom),20px);overflow:hidden;',
  'padding:max(env(safe-area-inset-top),18px) 16px max(env(safe-area-inset-bottom),20px);overflow-x:hidden;overflow-y:auto;',
);
source = source.replace(
  '.logo-mark img{display:block;width:100%;height:100%;object-fit:cover}',
  '.logo-mark img{display:block;width:100%;height:100%;object-fit:contain;padding:6px}',
);

source = source
  .replace('--teal:#15d5ca;', '--teal:#E51B23;')
  .replaceAll('rgba(21,213,202,.1)', 'rgba(229,27,35,.10)')
  .replaceAll('rgba(21,213,202,.88)', 'rgba(229,27,35,.88)')
  .replaceAll('rgba(21,213,202,.07)', 'rgba(229,27,35,.07)')
  .replaceAll('rgba(21,213,202,.08)', 'rgba(229,27,35,.08)')
  .replaceAll('rgba(23,220,209,.7)', 'rgba(229,27,35,.20)')
  .replace('linear-gradient(145deg,#0d2f32,#080808 62%)', 'linear-gradient(145deg,#FFFFFF,#F1F2F4 62%)')
  .replace('linear-gradient(135deg,#1ee1d4,#09b8b0)', 'linear-gradient(135deg,#E51B23,#C9141B)')
  .replace('.entregas .action{background:linear-gradient(135deg,#f7c847,#e9a90e);color:#04100f}', '.entregas .action{background:#E51B23;color:#FFFFFF}');

if (!source.includes('@media(max-height:720px)')) {
  source = source.replace(
    '    @media(max-width:380px){',
    '    @media(max-height:720px){.top{min-height:88px}.logo-mark{width:76px;height:76px}.brand{font-size:34px}.subtitle{font-size:9px}.hero{margin:10px auto 14px}.hero h1{font-size:28px}.hero p{margin-top:6px;font-size:12px}.service{min-height:265px}.photo{height:118px}.features{margin-top:10px}.feature{min-height:68px}.closing{padding-top:12px}.closing strong{font-size:24px}}\n    @media(max-width:380px){',
  );
}

const isReferenceV4 = source.includes('data-apois-reference-home-v4="true"');
const requiredMarkers = isReferenceV4
  ? [
      'overflow-x:hidden;overflow-y:auto',
      'class="brand-lockup"',
      'class="brand-mark"',
      '.visual svg',
      '@media(max-height:720px)',
      '.entregas .action',
    ]
  : [
      'overflow-x:hidden;overflow-y:auto',
      'object-fit:contain;padding:6px',
      '@media(max-height:720px)',
      '.service{min-height:265px}',
      '--teal:#E51B23;',
      '.entregas .action{background:#E51B23;color:#FFFFFF}',
      '.vehicle svg,.delivery svg',
    ];

for (const marker of requiredMarkers) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell cliente: ajuste mobile/identidade ausente (${marker})`);
}
if (source.includes('#15d5ca') || source.includes('#1ee1d4') || source.includes('#09b8b0')) {
  throw new Error('[FAIL] Shell cliente: cor teal antiga ainda aparece no seletor unificado.');
}

writeFileSync(path, source, 'utf8');
console.log(`[OK] Shell cliente: seletor claro vermelho/preto/branco, ícones consistentes, logo sem corte e layout responsivo (${path}).`);
