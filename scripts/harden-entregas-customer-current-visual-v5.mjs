// APOIS_ENTREGAS_CUSTOMER_VISUAL_V5
// Migracao exclusivamente visual Cliente Entregas -> identidade APOIS atual.
// Executar APOS customer-light-v4, antes de build:customer.
// Escopo: somente .work/entregas customer. Sem hooks, fetch, routing,
// Supabase, estabelecimentos, pedidos, pagamentos ou categorias.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas');
const load = (name) => readFileSync(resolve(root, name), 'utf8');
const save = (name, text) => writeFileSync(resolve(root, name), text, 'utf8');
function swap(source, from, to, label) {
  if (source.includes(to)) return source;
  const count = source.split(from).length - 1;
  if (count !== 1) throw Error('[FAIL] Entregas visual v5: ' + label + ', ocorrencias=' + count);
  return source.replace(from, to);
}
{
  const name='src/routes/inicio.tsx';
  let s=load(name);
  if(!s.includes('APOIS_ENTREGAS_CUSTOMER_VISUAL_V5')){
    if(!s.includes('data-apois-entregas-home-light-v4') || !s.includes('src={apoisClientBrand}')){
      throw Error('[FAIL] Entregas visual v5: primeiro aplicar o tema v4 e a logo oficial');
    }
    // Visibilidade maior da marca, sem alterar o componente/navegacao do header.
    s=swap(s,
      'data-apois-entregas-home-light-v4="true" className="relative flex h-screen w-full flex-col overflow-hidden bg-[#F7F7F8] text-[#171D27]"',
      'data-apois-entregas-home-light-v4="true" data-apois-entregas-home-v5="true" className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#F7F7F8] text-[#171D27]"',
      'home adaptada ao viewport real Android');
    // Outros hardeners ajustam a altura do container antes desta etapa.
    // Preservar essa evolução e aplicar apenas a cor/fundo e reserva segura.
    const mainPattern=/className="scrollbar-none flex-1[^"]*overflow-y-auto[^"]*"/;
    const mainMatch=s.match(mainPattern);
    if(!mainMatch)throw Error('[FAIL] Entregas visual v5: area principal de rolagem nao localizada');
    const mainClass=mainMatch[0];
    const updatedMain='className="scrollbar-none flex-1 space-y-4 overflow-y-auto bg-[#F7F7F8] px-4 pb-[max(130px,env(safe-area-inset-bottom))] pt-5"';
    if(mainClass!==updatedMain)s=s.replace(mainClass,updatedMain);
    s=swap(s,
      'shadow-[0_6px_24px_-12px_rgba(200,138,8,0.45)]',
      'shadow-[0_5px_18px_-7px_rgba(229,27,35,0.14)]',
      'cartao de endereco sem sombra antiga dourada');
    s=swap(s,
      'className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-primary/40 bg-zinc-950 shadow-[0_0_0_3px_rgba(246,190,28,0.08)]"',
      'className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-[#F0B9BD] bg-white shadow-[0_3px_14px_rgba(229,27,35,0.08)]"',
      'foto de perfil sobre fundo branco');
    s=swap(s,
      'className="group grid grid-cols-[84px_1fr] items-center gap-4 rounded-3xl border border-zinc-900 bg-zinc-950/50 p-3 text-left transition-all hover:border-accent/20 hover:bg-zinc-900/50 active:scale-[0.98] active:bg-zinc-900"',
      'className="group grid grid-cols-[84px_1fr] items-center gap-4 rounded-3xl border border-[#E2E5EA] bg-white p-3 text-left shadow-[0_6px_18px_rgba(21,30,45,0.045)] transition-all hover:border-[#EDB7BB] hover:bg-[#FFF8F8] active:scale-[0.98] active:bg-[#FFF1F2]"',
      'estabelecimento em cartao branco');
    s=swap(s,
      'className="truncate text-base font-extrabold text-white">{merchant.name}',
      'className="truncate text-base font-extrabold text-[#151B25]">{merchant.name}',
      'nome dos estabelecimentos com contraste forte');
    s=swap(s,
      'className="relative aspect-square w-full overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10"',
      'className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[#F3F4F6] ring-1 ring-[#E8EAF0]"',
      'imagem/fallback de loja claro');
    s=swap(s,
      'className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"',
      'className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent"',
      'gradiente legivel na imagem real');
    if(!s.includes('fetchMerchants(')||!s.includes('fetchMerchantCategories()')||
       !s.includes('navigate({ to: "/enderecos" })')||
       !s.includes('<AppBottomNav activeTab="inicio"')){
      throw Error('[FAIL] Entregas visual v5: foi alterado algum fluxo essencial da Home');
    }
  }
  save(name,s);
}
{
  const name='src/components/AppBottomNav.tsx';
  let s=load(name);
  if(!s.includes('data-apois-entregas-customer-nav-v5')){
    s=swap(s,
      '<nav className="',
      '<nav data-apois-entregas-customer-nav-v5="true" className="',
      'identificacao do rodape para estilo local');
    s=swap(s,
      'border-t border-[#E6E8EC] bg-white/95 shadow-[0_-5px_24px_rgba(31,38,50,.04)] backdrop-blur-xl',
      'border-t border-[#E6E8EC] bg-white/95 shadow-[0_-5px_24px_rgba(31,38,50,.06)] backdrop-blur-xl',
      'barra inferior branca');
    // Rotas, icones, numero de abas, botao Buscar e altura de toque preservados.
    if(!s.includes('aria-label="Buscar"') || !s.includes('min-h-[88px]') ||
       !s.includes('pb-[max(44px,env(safe-area-inset-bottom))]')){
      throw Error('[FAIL] Entregas visual v5: rodape seguro foi alterado');
    }
  }
  save(name,s);
}
{
  const name='src/system-theme.css';
  let css=load(name);
  const marker='/* APOIS_ENTREGAS_CUSTOMER_VISUAL_V5 */';
  if(!css.includes(marker)){
    css+='\n\n'+[
      marker,
      '/* SOMENTE <html> do produto customer. Nenhuma mudanca a courier/merchant/admin. */',
      'html.apois-entregas-customer-light-v4 { color-scheme:light; background-color:#F7F7F8; }',
      'html.apois-entregas-customer-light-v4 body { background-color:#F7F7F8!important; color:#151B25; }',
      'html.apois-entregas-customer-light-v4 .apois-customer-card,',
      'html.apois-entregas-customer-light-v4 .apois-system-card {background:#FFFFFF;border-color:#E4E6EB;box-shadow:0 6px 18px rgba(21,30,45,.05);}',
      '/* Reforca fundo e textos das telas internas antigas que usam Tailwind dark. */',
      'html.apois-entregas-customer-light-v4 [class~="bg-[#070707]"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-[#090909]"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-[#0B0B0B]"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-[#111111]"]{background-color:#F7F7F8!important;}',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-950/70"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-950/80"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-900/70"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-900/80"]{background-color:#FFFFFF!important;}',
      'html.apois-entregas-customer-light-v4 [class~="text-zinc-700"]{color:#687385!important;}',
      'html.apois-entregas-customer-light-v4 [class~="ring-white/10"]{--tw-ring-color:#E4E7EC!important;}',
      '/* Contraste preservado nos CTAs: texto branco sobre vermelho APOIS. */',
      'html.apois-entregas-customer-light-v4 .bg-primary.text-white,',
      'html.apois-entregas-customer-light-v4 .bg-primary [class~="text-white"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-red-600"][class~="text-white"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-red-500"][class~="text-white"]{color:#FFFFFF!important;}',
      'html.apois-entregas-customer-light-v4 [class*="from-primary"][class*="to-accent"] [class~="text-white"]{color:#FFFFFF!important;}',
      '/* Marca e navegacao: sem tocar semantica de status aberto, fechado e avisos. */',
      'html.apois-entregas-customer-light-v4 [data-apois-entregas-customer-nav-v5="true"]{background:#FFFFFF!important;border-color:#E6E8EC!important;}',
      'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] h1,',
      'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] h2,',
      'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] h3{color:#171D27;}',
      'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class*="bg-clip-text"][class*="text-transparent"]{-webkit-text-fill-color:transparent;color:transparent!important;}',
      'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="text-green-500"]{color:#16A34A!important;}',
      'html.apois-entregas-customer-light-v4 [data-apois-entregas-home-v5="true"] [class~="text-red-500"]{color:#DC2626!important;}',
    ].join('\n')+'\n';
  }
  save(name,css);
}
for(const [name,required] of [
  ['src/routes/__root.tsx','apois-entregas-customer-light-v4'],
  ['src/routes/inicio.tsx','data-apois-entregas-home-v5'],
  ['src/components/AppBottomNav.tsx','data-apois-entregas-customer-nav-v5'],
  ['src/system-theme.css','APOIS_ENTREGAS_CUSTOMER_VISUAL_V5'],
]){
  if(!load(name).includes(required))throw Error('[FAIL] Entregas visual v5, marcador faltante: '+name);
}
console.log('[OK] Entregas Cliente v5: fundo claro, marca vermelha, cards/CTA contrastados, nav branca; regras de negócio intactas.');
