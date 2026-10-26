// APOIS_ENTREGAS_CUSTOMER_VISUAL_V6
// Complemento puramente visual da v5, restrito ao HTML do Cliente Entregas.
// Nao altera hooks, pedidos, checkout, Supabase, estabelecimentos ou rotas.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const workspace=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/entregas');
const cssFile=resolve(workspace,'src/system-theme.css');
const homeFile=resolve(workspace,'src/routes/inicio.tsx');
const rootFile=resolve(workspace,'src/routes/__root.tsx');
const css=readFileSync(cssFile,'utf8');
const home=readFileSync(homeFile,'utf8');
const root=readFileSync(rootFile,'utf8');
if(!root.includes('product === "customer" ? "light apois-system-theme apois-entregas-customer-light-v4" : "dark apois-system-theme"'))
  throw Error('[FAIL] Entregas V6: separacao entre cliente e outros produtos ausente');
for(const token of ['data-apois-entregas-home-v5','src={apoisClientBrand}','fetchMerchants(','fetchMerchantCategories()','<AppBottomNav activeTab="inicio"']){
  if(!home.includes(token))throw Error('[FAIL] Entregas V6: precondicao da Home '+token);
}
if(!css.includes('/* APOIS_ENTREGAS_CUSTOMER_LIGHT_V4 */')||!css.includes('/* APOIS_ENTREGAS_CUSTOMER_VISUAL_V5 */'))
  throw Error('[FAIL] Entregas V6: temas anteriores nao foram aplicados');
const marker='/* APOIS_ENTREGAS_CUSTOMER_VISUAL_V6 */';
if(!css.includes(marker)){
  const additions=[
    marker,
    '/* Escopo exclusivamente cliente, isolado de courier/merchant/admin. */',
    'html.apois-entregas-customer-light-v4 {',
    ' --apois-client-primary:#E51B23;',
    ' --apois-client-primary-dark:#C9141B;',
    ' --apois-client-surface:#FFFFFF;',
    ' --apois-client-page:#F7F7F8;',
    ' --apois-client-text:#171D27;',
    ' color-scheme:light;',
    '}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"]{background-color:#F7F7F8!important;color:#171D27!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] header{background-color:#FFFFFF!important;border-bottom-color:#E4E6EA!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="bg-zinc-950"],',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="bg-zinc-950/50"],',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="bg-zinc-900"]{background-color:#FFFFFF!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="text-white"]:not([class*="bg-primary"]):not([class*="bg-red-"]){color:#171D27!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="text-zinc-400"]{color:#596272!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="text-zinc-500"]{color:#657083!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="border-zinc-800"]{border-color:#E4E6EA!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-customer-nav-v5="true"]{background:#FFFFFF!important;border-color:#E4E6EA!important;}',
    '/* Preserva estados semanticos: aberto=verde, fechado=vermelho, avisos=ambar. */',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] .bg-primary.text-white,',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] button.bg-primary [class~="text-white"]{color:#FFFFFF!important;}',
    '/* Rodape legivel, sem alterar links nem zonas de toque. */',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-customer-nav-v5="true"] [class~="text-zinc-500"]{color:#667085!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-customer-nav-v5="true"] [class~="text-primary"]{color:#E51B23!important;}',
  ];
  writeFileSync(cssFile,css+'\n\n'+additions.join('\n')+'\n','utf8');
}
const updated=readFileSync(cssFile,'utf8');
if(updated.split(marker).length!==2)throw Error('[FAIL] Entregas V6: regra visual duplicada');
console.log('[OK] APOIS Entregas Cliente V6: branco/vermelho/preto, leitura e rodape protegidos; outros produtos intactos.');
