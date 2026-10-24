// APOIS_ENTREGAS_CUSTOMER_LIGHT_V4 — exclusivamente visual, escopo CUSTOMER.
// As telas de entregador, estabelecimento e admin conservam sua classe dark.
// Nao alterar hooks, navegacao, checkout, pagamentos, Supabase ou pedidos.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const work=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/entregas');
const read=p=>readFileSync(resolve(work,p),'utf8');
const write=(p,v)=>writeFileSync(resolve(work,p),v,'utf8');
function exact(source,a,b,reason){
  if(source.includes(b))return source;
  const count=source.split(a).length-1;
  if(count!==1)throw Error('[FAIL] Entregas light v4: '+reason+' ['+count+']');
  return source.replace(a,b);
}
{
  const p='src/routes/__root.tsx';let s=read(p);
  s=exact(s,'<html lang="pt-BR" className="dark apois-system-theme">',
    '<html lang="pt-BR" className={product === "customer" ? "light apois-system-theme apois-entregas-customer-light-v4" : "dark apois-system-theme"}>',
    'root light only customer');
  s=exact(s,'<body className="bg-black antialiased">',
    '<body className={product === "customer" ? "bg-[#F7F7F8] antialiased" : "bg-black antialiased"}>',
    'body light only customer');
  write(p,s);
}
{
  const p='src/system-theme.css';let s=read(p);
  const marker='/* APOIS_ENTREGAS_CUSTOMER_LIGHT_V4 */';
  if(!s.includes(marker)){
    const css=[
      marker,
      '/* A classe abaixo existe apenas no HTML do Cliente Entregas. */',
      'html.apois-system-theme.apois-entregas-customer-light-v4 {',
      '  color-scheme:light;',
      '  --background:oklch(.982 .002 85);--foreground:oklch(.17 .012 260);',
      '  --card:oklch(1 0 0);--card-foreground:oklch(.17 .012 260);',
      '  --popover:oklch(1 0 0);--popover-foreground:oklch(.17 .012 260);',
      '  --primary:oklch(.59 .24 27);--primary-foreground:oklch(1 0 0);',
      '  --secondary:oklch(.958 .004 85);--secondary-foreground:oklch(.20 .01 260);',
      '  --muted:oklch(.952 .004 85);--muted-foreground:oklch(.46 .012 260);',
      '  --accent:oklch(.57 .23 27);--accent-foreground:oklch(1 0 0);',
      '  --border:oklch(.91 .006 85);--input:oklch(.918 .005 85);--ring:oklch(.59 .24 27);',
      '  --sidebar:oklch(1 0 0);--sidebar-foreground:oklch(.17 .012 260);',
      '  --sidebar-primary:oklch(.59 .24 27);--sidebar-primary-foreground:oklch(1 0 0);',
      '  --sidebar-accent:oklch(.952 .004 85);--sidebar-accent-foreground:oklch(.20 .01 260);',
      '  --sidebar-border:oklch(.91 .006 85);--sidebar-ring:oklch(.59 .24 27);',
      '}',
      'html.apois-entregas-customer-light-v4 body, html.apois-entregas-customer-light-v4 body>div {background:#F7F7F8;color:#181D27;}',
      'html.apois-entregas-customer-light-v4 [class~="bg-black"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-black/80"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-black/85"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-black/95"] {background-color:#F7F7F8!important;}',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-950"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-950/90"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-950/50"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-950/40"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-950/30"] {background-color:#FFF!important;}',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-900"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-900/30"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-900/40"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-900/50"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-900/60"] {background-color:#F3F4F6!important;}',
      'html.apois-entregas-customer-light-v4 [class~="bg-zinc-800"] {background-color:#E8EAED!important;}',
      'html.apois-entregas-customer-light-v4 [class*="from-zinc-950"][class*="to-black"] {background-image:none!important;background:#FFF!important;}',
      'html.apois-entregas-customer-light-v4 [class~="border-zinc-900"],',
      'html.apois-entregas-customer-light-v4 [class~="border-zinc-900/50"],',
      'html.apois-entregas-customer-light-v4 [class~="border-zinc-800"],',
      'html.apois-entregas-customer-light-v4 [class~="border-zinc-800/50"] {border-color:#E4E6EA!important;}',
      'html.apois-entregas-customer-light-v4 [class~="text-zinc-100"],',
      'html.apois-entregas-customer-light-v4 [class~="text-zinc-200"],',
      'html.apois-entregas-customer-light-v4 [class~="text-zinc-300"] {color:#232A35!important;}',
      'html.apois-entregas-customer-light-v4 [class~="text-zinc-400"],',
      'html.apois-entregas-customer-light-v4 [class~="text-zinc-500"],',
      'html.apois-entregas-customer-light-v4 [class~="text-zinc-600"] {color:#606978!important;}',
      'html.apois-entregas-customer-light-v4 [class~="text-white"]:not([class~="bg-primary"]):not([class~="bg-red-500"]):not([class~="bg-red-600"]):not([class~="bg-black/60"]):not([class~="bg-black/70"]) {color:#171D27!important;}',
      'html.apois-entregas-customer-light-v4 [class~="bg-primary"] [class~="text-white"],',
      'html.apois-entregas-customer-light-v4 [class~="bg-red-500"] [class~="text-white"] {color:#FFF!important;}',
      'html.apois-entregas-customer-light-v4 input:not([type="checkbox"]):not([type="radio"]),',
      'html.apois-entregas-customer-light-v4 textarea,',
      'html.apois-entregas-customer-light-v4 select {color:#171D27;caret-color:#E51B23;border-color:#E0E3E8;}',
      'html.apois-entregas-customer-light-v4 input::placeholder {color:#737B87;}',
      'html.apois-entregas-customer-light-v4 [class*="from-primary"][class*="to-accent"] {background-image:linear-gradient(110deg,#E51B23,#C9141B)!important;}',
      'html.apois-entregas-customer-light-v4 [class*="bg-clip-text"][class*="text-transparent"] {color:transparent!important;}',
      'html.apois-entregas-customer-light-v4 .apois-customer-card {background:#FFF;border-color:#E4E6EA;box-shadow:0 8px 22px rgba(27,33,43,.06);}',
      'html.apois-entregas-customer-light-v4 .apois-customer-soft-glow {box-shadow:0 8px 22px rgba(229,27,35,.18);}',
    ].join('\n');
    s+='\n\n'+css+'\n';
  }
  write(p,s);
}
{
  const p='src/routes/inicio.tsx';let s=read(p);
  // A logomarca antiga tem letras brancas desenhadas para fundo preto;
  // a versão clara exibe o emblema oficial + título em preto/vermelho.
  s=exact(s,'import logoAsset from "@/assets/logo.png.asset.json";',
    'import apoisClientBrand from "@/assets/apoisClientBrandData";',
    'marca oficial Cliente Entregas');
  const oldLogo=['        <img','          src={logoAsset.url}','          alt="APOIS ENTREGA"',
    '          className="h-10 w-auto object-contain object-left"','        />'].join('\n');
  const newLogo=[
    '        <div className="flex min-w-0 items-center gap-2.5">',
    '          <img src={apoisClientBrand} alt="APOIS" className="h-11 w-11 shrink-0 rounded-full object-contain" />',
    '          <div className="min-w-0 leading-none">',
    '            <span className="block text-[24px] font-black tracking-tight text-[#111827]">APOIS</span>',
    '            <span className="mt-1 block text-[10px] font-black uppercase tracking-[0.22em] text-[#D71920]">ENTREGAS</span>',
    '          </div>',
    '        </div>',
  ].join('\n');
  s=exact(s,oldLogo,newLogo,'marca legível sobre fundo branco');
  const mutations=[
    ['className="relative flex h-screen w-full flex-col overflow-hidden bg-black text-white"',
     'data-apois-entregas-home-light-v4="true" className="relative flex h-screen w-full flex-col overflow-hidden bg-[#F7F7F8] text-[#171D27]"','home'],
    ['border-b border-accent/15 px-4 pb-3 pt-[max(env(safe-area-inset-top),1.25rem)]',
     'border-b border-[#E7E9ED] bg-white/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),1.25rem)]','header'],
    ['className="relative mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-zinc-800 bg-zinc-950 text-white"',
     'className="relative mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E4E6EA] bg-white text-[#171D27] shadow-sm"','sacola'],
    ['border border-accent/30 bg-gradient-to-r from-zinc-950 to-black px-3 py-3.5',
     'border border-[#F0C4C7] bg-white px-3 py-3.5','endereco'],
    ['className="block truncate text-base font-semibold text-white"',
     'className="block truncate text-base font-bold text-[#171D27]"','endereco legivel'],
    ['className="h-13 cursor-pointer rounded-2xl border-zinc-800 bg-zinc-950/90 pl-12 text-[15px] text-white shadow-inner shadow-black/60 placeholder:text-zinc-500 focus-visible:border-accent/50 focus-visible:ring-accent/30"',
     'className="h-13 cursor-pointer rounded-2xl border-[#E2E4E8] bg-white pl-12 text-[15px] text-[#171D27] shadow-sm placeholder:text-[#737B87] focus-visible:border-[#E51B23]/50 focus-visible:ring-[#E51B23]/25"','busca'],
    ['bg-zinc-900 ring-1 ring-white/10 transition-transform group-active:scale-95',
     'border border-[#E7E9ED] bg-white shadow-[0_5px_16px_rgba(20,27,40,0.05)] transition-transform group-active:scale-95','categorias'],
    ['className="w-full truncate text-center text-[11px] font-medium text-zinc-300"',
     'className="w-full truncate text-center text-[11px] font-semibold text-[#353C47]"','nomes das categorias'],
  ];
  for(const [a,b,label]of mutations)s=exact(s,a,b,label);
  write(p,s);
}
{
  const p='src/components/AppBottomNav.tsx';let s=read(p);
  s=exact(s,
    'border-t border-border/80 bg-background/95 backdrop-blur-xl',
    'border-t border-[#E6E8EC] bg-white/95 shadow-[0_-5px_24px_rgba(31,38,50,.04)] backdrop-blur-xl',
    'nav superior claro');
  write(p,s);
}
for(const [p,term]of [
  ['src/routes/__root.tsx','apois-entregas-customer-light-v4'],
  ['src/routes/inicio.tsx','data-apois-entregas-home-light-v4'],
  ['src/system-theme.css','APOIS_ENTREGAS_CUSTOMER_LIGHT_V4'],
  ['src/components/AppBottomNav.tsx','border-[#E6E8EC] bg-white/95'],
]) if(!read(p).includes(term))throw Error('[FAIL] brand v4 sem marcador '+p);
console.log('[OK] APOIS Entregas customer-only: branco/vermelho/preto + categoria, busca, sacola e abas preservadas.');
