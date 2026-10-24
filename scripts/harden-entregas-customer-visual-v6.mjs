// APOIS_ENTREGAS_CUSTOMER_VISUAL_V6 — finalização somente visual no módulo Cliente.
// Mantém código de rotas, auth, busca, lojas, preços, pagamentos e pedidos intactos.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/entregas');
const get=x=>readFileSync(resolve(root,x),'utf8');
const put=(x,s)=>writeFileSync(resolve(root,x),s,'utf8');
const rootPage=get('src/routes/__root.tsx');
const home=get('src/routes/inicio.tsx');
const nav=get('src/components/AppBottomNav.tsx');
if(!rootPage.includes('product === "customer" ? "light apois-system-theme apois-entregas-customer-light-v4"')||
   !home.includes('data-apois-entregas-home-v5')||
   !nav.includes('data-apois-entregas-customer-nav-v5')){
 throw Error('[FAIL] Entregas Cliente V6: requer temas V4/V5 aplicados antes.');
}
const marker='/* APOIS_ENTREGAS_CUSTOMER_VISUAL_V6 */';
const file='src/system-theme.css';
let css=get(file);
if(!css.includes(marker)){
  css+='\n'+[
    marker,
    '/* Somente Cliente Entregas; NÃO se aplica a entregador, comerciante ou admin. */',
    'html.apois-entregas-customer-light-v4{color-scheme:light;--background:#F7F7F8;--foreground:#161B25;--card:#FFFFFF;--card-foreground:#161B25;--primary:#E51B23;--primary-foreground:#FFFFFF;--accent:#C9141B;--border:#E5E7EB;--ring:#E51B23;}',
    'html.apois-entregas-customer-light-v4 body,html.apois-entregas-customer-light-v4 #root{background:#F7F7F8;color:#161B25;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"]{background:#F7F7F8!important;color:#161B25!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="bg-black"],html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="bg-zinc-950"]{background:#FFFFFF!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="text-white"]:not([class*="bg-primary"]):not([class*="bg-red-"]){color:#161B25!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class*="bg-gradient-to-"] [class~="text-white"]{color:#FFFFFF!important;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] input{background:#FFFFFF;color:#161B25;border-color:#E5E7EB;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] input::placeholder{color:#69717D;opacity:1;}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-customer-nav-v5="true"]{background:#FFFFFF!important;border-color:#E5E7EB!important;box-shadow:0 -4px 16px rgba(22,27,37,.05);}',
    'html.apois-entregas-customer-light-v4 [data-apois-entregas-customer-nav-v5="true"] [aria-current="page"]{color:#E51B23;}',
    '/* Texto de CTA permanece branco; alertas e status conservam suas cores semanticas. */',
    'html.apois-entregas-customer-light-v4 [class~="bg-primary"][class~="text-white"],html.apois-entregas-customer-light-v4 [class~="bg-red-600"][class~="text-white"]{color:#FFFFFF!important;}',
  ].join('\n')+'\n';
}
put(file,css);
for(const token of [marker,'#F7F7F8','#E51B23','#161B25','[data-apois-entregas-home-v5="true"]']){
 if(!get(file).includes(token))throw Error('[FAIL] Entregas v6: '+token);
}
console.log('[OK] Entregas Cliente: Home, busca e navegação com fundo claro, vermelho APOIS e contraste. Outros módulos preservados.');
