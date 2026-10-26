// Gate visual do Cliente Entregas; leitura somente, sem build/deploy.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/entregas');
const read=p=>readFileSync(resolve(root,p),'utf8');
const css=read('src/system-theme.css');
const home=read('src/routes/inicio.tsx');
const nav=read('src/components/AppBottomNav.tsx');
const shell=read('src/routes/__root.tsx');
assert.equal(css.split('/* APOIS_ENTREGAS_CUSTOMER_VISUAL_V6 */').length-1,1,'tema V6 deve estar presente uma vez');
assert.ok(shell.includes('product === "customer" ? "light apois-system-theme apois-entregas-customer-light-v4" : "dark apois-system-theme"'),'nao afetar Entregador, Comerciante e Admin');
assert.ok(home.includes('data-apois-entregas-home-v5="true"')&&home.includes('src={apoisClientBrand}'),'logo e home oficial preservadas');
for(const token of ['#E51B23','#C9141B','#F7F7F8','#FFFFFF','#171D27','data-apois-entregas-home-v5','data-apois-entregas-customer-nav-v5'])assert.ok(css.includes(token),'cor/painel ausente '+token);
for(const token of ['fetchMerchants(','fetchMerchantCategories()','merchant.delivery_fee','navigate({ to: "/enderecos" })','navigate({ to: "/buscar" })','navigate({ to: "/sacola" })','<AppBottomNav activeTab="inicio"'])assert.ok(home.includes(token),'fluxo Home perdido '+token);
for(const token of ['aria-label="Buscar"','"/inicio"','"/pedidos"','"/favoritos"','"/perfil"','"/buscar"','pb-[max(44px,env(safe-area-inset-bottom))]'])assert.ok(nav.includes(token),'menu/navegacao alterado '+token);
assert.ok(!css.includes('html.apois-system-theme:not(.apois-entregas-customer-light-v4) {color-scheme:light'),'outros produtos devem manter tema');
console.log('[OK] Cliente Entregas V6: identidade clara APOIS com fluxo de estabelecimentos, enderecos, pedidos e abas preservados.');
