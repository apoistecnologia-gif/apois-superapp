import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('superapp/shell/index.html');
let html = readFileSync(path, 'utf8');

function replaceOnce(search, replacement, label) {
  if (html.includes(replacement)) return;
  if (!html.includes(search)) throw new Error(`${label}: padrão não encontrado`);
  html = html.replace(search, replacement);
}

replaceOnce(
  '</style>',
  `.service.motorista{grid-column:1/-1;min-height:178px;border-color:rgba(246,190,28,.55);display:grid;grid-template-columns:112px 1fr;column-gap:14px;align-items:center}.motorista .photo{height:132px;background:radial-gradient(circle at 58% 34%,rgba(246,190,28,.55),transparent 24%),linear-gradient(145deg,#251d0a,#080808 62%)}.motorista .photo:after{background:linear-gradient(180deg,transparent 36%,rgba(0,0,0,.78) 100%)}.motorista .driver{position:relative;z-index:1;margin-bottom:22px;font-size:54px}.motorista .badge{border:1px solid var(--gold);color:var(--gold)}.motorista .service-copy{min-width:0}.motorista h2,.motorista p{text-align:left}.motorista h2{margin-top:0}.motorista .action{margin-top:12px;background:linear-gradient(135deg,#f7c847,#e9a90e);color:#050505}@media(max-width:380px){.service.motorista{grid-template-columns:92px 1fr;column-gap:10px}.motorista .photo{height:116px}.motorista .driver{font-size:45px}}
  </style>`,
  'shell: estilo Motorista',
);

replaceOnce(
  '</section>\n      <section class="features"',
  `<article class="service motorista"><div class="photo"><div class="badge">🚘</div><div class="driver">👤🚗</div></div><div class="service-copy"><h2>Motorista</h2><p>Fique online • Receba corridas • Acompanhe seus ganhos</p><button class="action" data-module="motorista" type="button">Área do motorista <span>→</span></button></div></article></section>
      <section class="features"`,
  'shell: cartão Motorista',
);

replaceOnce(
  "const moduleUrls={corridas:'./modules/corridas/index.html',entregas:'./modules/entregas/index.html'};",
  "const moduleUrls={corridas:'./modules/corridas/index.html',entregas:'./modules/entregas/index.html',motorista:'./modules/motorista/index.html'};",
  'shell: URL Motorista',
);

replaceOnce(
  "      return moduleName==='corridas'?'apois-superapp-corridas-auth-v1':'apois-superapp-entregas-auth-v1';",
  "      if(moduleName==='corridas')return 'apois-superapp-corridas-auth-v1';\n      if(moduleName==='motorista')return 'apois-superapp-motorista-auth-v1';\n      return 'apois-superapp-entregas-auth-v1';",
  'shell: sessão Motorista',
);

replaceOnce(
  "      return hasPersistedSession(moduleName)?base+'#/inicio':base+'#/login';",
  "      if(moduleName==='motorista')return hasPersistedSession(moduleName)?base+'#/motorista/app':base+'#/motorista/login';\n      // invariant: return hasPersistedSession(moduleName)?base+'#/inicio':base+'#/login';\n      return hasPersistedSession(moduleName)?base+'#/inicio':base+'#/login';",
  'shell: rota inicial Motorista',
);

replaceOnce(
  "        if(path==='corridas-reset'){",
  "        if(path==='mercadopago'){\n          try{localStorage.setItem(LAST_MODULE_KEY,'motorista');}catch{}\n          void window.Capacitor?.Plugins?.Browser?.close?.().catch(()=>undefined);\n          window.location.replace(`./modules/motorista/index.html#/motorista/assinatura${suffix()}`);\n          return true;\n        }\n        if(path==='corridas-reset'){",
  'shell: retorno OAuth Mercado Pago',
);

writeFileSync(path, html, 'utf8');
console.log('[OK] Shell expõe Motorista e roteia retorno Mercado Pago.');
