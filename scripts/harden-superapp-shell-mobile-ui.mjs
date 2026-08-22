import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
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

// O Superapp inteiro usa a identidade APOIS preto/dourado. O antigo teal da
// coluna Entregas vinha de uma experiência visual anterior e fazia o seletor
// parecer dois aplicativos sem relação entre si.
source = source
  .replace('--teal:#15d5ca;', '--teal:#f2b414;')
  .replaceAll('rgba(21,213,202,.1)', 'rgba(242,180,20,.10)')
  .replaceAll('rgba(21,213,202,.88)', 'rgba(242,180,20,.88)')
  .replaceAll('rgba(21,213,202,.07)', 'rgba(242,180,20,.07)')
  .replaceAll('rgba(21,213,202,.08)', 'rgba(242,180,20,.08)')
  .replaceAll('rgba(23,220,209,.7)', 'rgba(242,180,20,.68)')
  .replace('linear-gradient(145deg,#0d2f32,#080808 62%)', 'linear-gradient(145deg,#2b2110,#080808 62%)')
  .replace('linear-gradient(135deg,#1ee1d4,#09b8b0)', 'linear-gradient(135deg,#f7c847,#e9a90e)')
  .replace('.entregas .action{background:linear-gradient(135deg,#f7c847,#e9a90e);color:#04100f}', '.entregas .action{background:linear-gradient(135deg,#f7c847,#e9a90e);color:#050505}');

if (!source.includes('@media(max-height:720px)')) {
  source = source.replace(
    '    @media(max-width:380px){',
    '    @media(max-height:720px){.top{min-height:88px}.logo-mark{width:76px;height:76px}.brand{font-size:34px}.subtitle{font-size:9px}.hero{margin:10px auto 14px}.hero h1{font-size:28px}.hero p{margin-top:6px;font-size:12px}.service{min-height:265px}.photo{height:118px}.features{margin-top:10px}.feature{min-height:68px}.closing{padding-top:12px}.closing strong{font-size:24px}}\n    @media(max-width:380px){',
  );
}

for (const marker of [
  'overflow-x:hidden;overflow-y:auto',
  'object-fit:contain;padding:6px',
  '@media(max-height:720px)',
  '.service{min-height:265px}',
  '--teal:#f2b414;',
  '.entregas .action{background:linear-gradient(135deg,#f7c847,#e9a90e);color:#050505}',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell cliente: ajuste mobile/identidade ausente (${marker})`);
}
if (source.includes('#15d5ca') || source.includes('#1ee1d4') || source.includes('#09b8b0')) {
  throw new Error('[FAIL] Shell cliente: cor teal antiga ainda aparece no seletor unificado.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Shell cliente: seletor preto/dourado rola em telas baixas, logo não é cortada e layout compacta sem esconder conteúdo.');
