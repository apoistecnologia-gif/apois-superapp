// Gate visual APOIS Cliente Entregas v5. Nao solicita pedidos nem altera backend.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const work=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/entregas');
const read=p=>readFileSync(resolve(work,p),'utf8');
const root=read('src/routes/__root.tsx');
const home=read('src/routes/inicio.tsx');
const nav=read('src/components/AppBottomNav.tsx');
const css=read('src/system-theme.css');
const packageJson=JSON.parse(read('package.json'));
assert.ok(root.includes('product === "customer" ? "light apois-system-theme apois-entregas-customer-light-v4" : "dark apois-system-theme"'),
  'O modo claro deve ser EXCLUSIVO do Cliente');
assert.ok(root.includes('product === "customer" ? "bg-[#F7F7F8] antialiased" : "bg-black antialiased"'),
  'Admin, comerciante e entregador devem permanecer intocados');
assert.ok(root.includes('<CartProvider>') && root.includes('<Outlet />') &&
  root.includes('<CustomerPushManager />') && root.includes('<CourierOfferOverlay />'),
  'Providers/navegacao ou notificacoes alterados');
for(const text of [
  'data-apois-entregas-home-v5','src={apoisClientBrand}',
  'bg-[#F7F7F8] text-[#171D27]',
  'bg-white p-3 text-left shadow-',
  'text-[#151B25]">{merchant.name}',
  'fetchMerchantCategories()','fetchMerchants(',
  'navigate({ to: "/enderecos" })','navigate({ to: "/buscar" })',
  'navigate({ to: "/sacola" })','<AppBottomNav activeTab="inicio"',
  'catRestaurantes','catMercados','catFarmacias','catLojas',
  'calculateMerchantStatus(','merchant.delivery_fee',
])assert.ok(home.includes(text),'Home perdeu estilo/funcao: '+text);
assert.ok(!home.includes('className="relative flex h-screen w-full flex-col overflow-hidden bg-black text-white"'),
  'Home Cliente ainda ficou preta');
for(const text of [
  'data-apois-entregas-customer-nav-v5',
  'min-h-[88px]','min-h-[64px]',
  'pb-[max(44px,env(safe-area-inset-bottom))]',
  'aria-label="Buscar"',
  '"/inicio"','"/pedidos"','"/favoritos"','"/perfil"','"/buscar"',
])assert.ok(nav.includes(text),'Navegacao funcional/safe-area perdida: '+text);
for(const text of [
  '/* APOIS_ENTREGAS_CUSTOMER_LIGHT_V4 */',
  '/* APOIS_ENTREGAS_CUSTOMER_VISUAL_V5 */',
  'html.apois-entregas-customer-light-v4',
  'color-scheme:light',
  'background-color:#F7F7F8',
  'color:#FFFFFF!important',
  'data-apois-entregas-customer-nav-v5',
])assert.ok(css.includes(text),'CSS nao cobre marca ou contraste: '+text);
assert.equal(css.split('/* APOIS_ENTREGAS_CUSTOMER_VISUAL_V5 */').length-1,1,'Tema v5 duplicado');
assert.ok(!css.includes('html.apois-system-theme:not(.apois-entregas-customer-light-v4) {color-scheme:light'),
  'Produtos de parceiro foram afetados');
assert.ok(packageJson.scripts?.['build:customer'], 'Build real Cliente Entregas perdido');
console.log('[OK] Entregas Cliente V5: identidade vermelho/branco/preto, menus/fluxos preservados, sem efeitos nos demais produtos.');
