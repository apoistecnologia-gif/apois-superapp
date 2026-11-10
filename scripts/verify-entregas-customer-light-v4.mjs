// APOIS Entregas - gate visual de regressao v4. Executar apos o hardener.
// Nunca faz chamadas externas, nunca altera dados, nao produz APK.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const work=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/entregas');
const read=p=>readFileSync(resolve(work,p),'utf8');
const root=read('src/routes/__root.tsx');
const home=read('src/routes/inicio.tsx');
const hours=read('src/lib/merchant-hours.ts');
const nav=read('src/components/AppBottomNav.tsx');
const css=read('src/system-theme.css');
const modules=read('src/assets/apoisClientBrandData.ts');
const themeMarker='APOIS_ENTREGAS_CUSTOMER_LIGHT_V4';
for(const s of [
  'product === "customer" ? "light apois-system-theme apois-entregas-customer-light-v4" : "dark apois-system-theme"',
  'product === "customer" ? "bg-[#F7F7F8] antialiased" : "bg-black antialiased"',
  '<CartProvider>','<Outlet />','<CustomerPushManager />','<CourierOfferOverlay />',
  '<MerchantOrderSoundWatcher />'
])assert.ok(root.includes(s),'RootShell foi modificado incorretamente ou tema nao chegou ao HTML: '+s);
assert.ok(root.includes('const product = getApoisProductMode();'),'Tema deve respeitar produto autenticado');
assert.ok(!root.includes('<html lang="pt-BR" className="light apois-system-theme">'),'Tema nao pode afetar todos os produtos');
for(const term of [
  'apois-system-theme.apois-entregas-customer-light-v4',
  'color-scheme:light',
  '--background:oklch(.982',
  '--foreground:oklch(.17',
  '--primary:oklch(.59 .24 27)',
  '[class~="bg-black"]',
  '[class~="bg-zinc-950"]',
  '[class~="text-zinc-300"]',
  '[class~="text-white"]',
  '[class~="bg-primary"] [class~="text-white"]',
])assert.ok(css.includes(term),'Tema claro sem sobreposicao segura: '+term);
assert.equal(css.split('/* '+themeMarker+' */').length-1,1,'Tema nao pode duplicar regras');
for(const term of [
  'data-apois-entregas-home-light-v4',
  'src={apoisClientBrand}', 'alt="APOIS"',
  'text-[#111827]','text-[#D71920]',
  '<AppBottomNav activeTab="inicio"',
  'onClick={() => navigate({ to: "/sacola" })}',
  'onClick={() => navigate({ to: "/enderecos" })}',
  'onClick={() => navigate({ to: "/buscar" })}',
  'fetchMerchantCategories()', 'fetchMerchants(',
  'fetchAuthoritativeMerchantStatuses(', 'authoritativeStatus[merchant.id]', 'APOIS_MERCHANT_SERVER_STATUS_V3', 'setDefaultAddress(',
  'catRestaurantes','catMercados','catFarmacias','catLojas'
])assert.ok(home.includes(term),'A Home perdeu visual/fluxo: '+term);
assert.ok(!home.includes('src={logoAsset.url}'),'Logo branco antigo nao e legivel em fundo claro');
assert.ok(modules.includes('data:image/png;base64,'),'Emblema oficial ainda nao instalado no workspace');
for(const to of ['"/inicio"','"/pedidos"','"/favoritos"','"/perfil"','"/buscar"'])
  assert.ok(nav.includes(to),'Destino do menu foi removido: '+to);
assert.ok(nav.includes('bg-white/95')&&nav.includes('border-[#E6E8EC]'),'Rodape nao segue o tema claro');
assert.ok(nav.includes('min-h-[88px]')&&nav.includes('min-h-[64px]')&&nav.includes('pb-[max(44px,env(safe-area-inset-bottom))]'),'Menu nao preserva area de toque grande e safe area Android');
// Server-authoritative merchant availability replaces device-clock guesses.
assert.ok(hours.includes('"apois_visible_merchant_order_status"'), 'Status must use server RPC');
assert.ok(!home.includes('calculateMerchantStatus('), 'Home must not infer open hours from device time');
console.log('[OK] Entregas: tema claro escopado somente ao Cliente; identidade e navegacao preservadas sem modificar operacoes.');
