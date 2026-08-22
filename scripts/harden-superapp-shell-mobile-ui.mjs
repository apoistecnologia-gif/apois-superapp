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
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell cliente: ajuste mobile ausente (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Shell cliente: seletor rola em telas baixas, logo não é cortada e layout compacta sem esconder conteúdo.');
