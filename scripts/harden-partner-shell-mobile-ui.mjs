import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/partner-shell/index.html');
let source = readFileSync(path, 'utf8');

const isReferenceV4 = source.includes('data-apois-partner-reference-v4="true"');

if (!isReferenceV4) {
  source = source.replace(
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#050505;color:#fff}body{min-height:100dvh}',
    '*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:#050505;color:#fff}body{min-height:100dvh;overflow-x:hidden;overflow-y:auto}',
  );
  source = source.replace(
    '.logo img{display:block;width:100%;height:100%;object-fit:cover}',
    '.logo img{display:block;width:100%;height:100%;object-fit:contain;padding:8px}',
  );
  source = source.replace(
    '.screen{min-height:100dvh;max-width:520px;margin:0 auto;padding:max(env(safe-area-inset-top),28px) 18px max(env(safe-area-inset-bottom),24px);display:flex;flex-direction:column;justify-content:center;',
    '.screen{min-height:100dvh;max-width:520px;margin:0 auto;padding:max(env(safe-area-inset-top),20px) 18px max(env(safe-area-inset-bottom),20px);display:flex;flex-direction:column;justify-content:center;',
  );

  if (!source.includes('@media(max-height:700px)')) {
    source = source.replace(
      '  </style>',
      '    @media(max-height:700px){.screen{justify-content:flex-start}.logo{width:92px;height:92px;margin-bottom:10px}.brand h1{font-size:29px}.brand p{margin-top:7px;font-size:13px}.choices{margin-top:20px;gap:10px}.card{border-radius:22px;padding:15px}.card strong{font-size:19px}.card span{margin-top:4px;font-size:12px}.card button{margin-top:12px;height:48px}.foot{margin-top:18px}}\n    @media(max-width:360px){.screen{padding-left:14px;padding-right:14px}.brand h1{font-size:28px}.card{padding:14px}.card strong{font-size:18px}}\n  </style>',
    );
  }
}

const required = isReferenceV4
  ? [
      'data-apois-partner-reference-v4="true"',
      'overflow-x:hidden;overflow-y:auto',
      'class="partner-mark"',
      'class="partner-wordmark"',
      'class="role-card motorista"',
      'class="role-card entregador"',
      'data-module="motorista"',
      'data-module="entregador"',
      '@media(max-height:780px)',
      '@media(max-width:380px)',
      'object-fit:contain',
      'Entrar como motorista',
      'Entrar como entregador',
    ]
  : [
      'overflow-x:hidden;overflow-y:auto',
      'object-fit:contain;padding:8px',
      '@media(max-height:700px)',
      '@media(max-width:360px)',
    ];

for (const marker of required) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Shell Parceiro: ajuste mobile/referência ausente (${marker})`);
}

if (isReferenceV4 && (/class="logo"/.test(source) || /object-fit:cover/.test(source))) {
  throw new Error('[FAIL] Shell Parceiro: referência V4 reintroduziu logo circular/cortada');
}

writeFileSync(path, source, 'utf8');
console.log(isReferenceV4
  ? '[OK] Shell Parceiro V4: referência premium aplicada, marca íntegra e cartões Motorista/Entregador responsivos.'
  : '[OK] Shell Parceiro: logo não corta, seletor adapta telas baixas/estreitas e permanece rolável.');
