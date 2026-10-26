// APOIS_ENTREGAS_PERSONAL_DATA_LIGHT_V1
// Corrige campos quase pretos sobre fundo preto e botão Salvar encoberto na
// tela de dados pessoais. Somente classes Tailwind e layout, nunca persistência.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/entregas');
const file=resolve(root,'src/routes/perfil/dados-pessoais.tsx');
const before=readFileSync(file,'utf8');
let source=before;
const marker='APOIS_ENTREGAS_PERSONAL_DATA_LIGHT_V1';
function change(from,to,label){
  if(source.includes(to))return;
  if(source.split(from).length!==2)throw Error('[FAIL] Dados Pessoais: '+label);
  source=source.replace(from,to);
}
if(!source.includes(marker)){
  change('className="relative flex h-screen w-full flex-col overflow-hidden bg-black text-white"',
    'data-apois-personal-data-light-v1="true" className="relative flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-[#F7F7F8] text-[#171D27]"',
    'layout claro');
  change('className="z-50 flex shrink-0 items-center justify-between border-b border-zinc-900 bg-black/80 px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)] backdrop-blur-lg"',
    'className="z-30 flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 pb-4 pt-[max(env(safe-area-inset-top),1rem)]"',
    'cabecalho');
  change('className="rounded-full bg-zinc-900 p-2"',
    'className="grid h-11 w-11 place-items-center rounded-full bg-[#F3F4F6] p-2 text-[#171D27]"',
    'botao voltar');
  change('className="scrollbar-none flex-1 overflow-y-auto p-6 pb-[calc(env(safe-area-inset-bottom)+7rem)]"',
    'className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+9rem)] pt-6"',
    'scroll e area inferior');
  change('className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-primary bg-zinc-900"',
    'className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-primary bg-white"',
    'avatar');
  change('className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full border-4 border-black bg-primary text-black"',
    'className="absolute -bottom-1 -right-1 grid h-10 w-10 place-items-center rounded-full border-4 border-white bg-primary text-white"',
    'camera');
  change('className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-black disabled:opacity-50"',
    'className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 font-extrabold text-white shadow-md disabled:opacity-50"',
    'contraste salvar');
  change('className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"',
    'className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#697386]"',
    'icone do campo');
  change('className="[&_.profile-input]:w-full [&_.profile-input]:rounded-2xl [&_.profile-input]:border [&_.profile-input]:border-zinc-800 [&_.profile-input]:bg-zinc-900 [&_.profile-input]:py-4 [&_.profile-input]:pl-12 [&_.profile-input]:pr-4 [&_.profile-input]:text-white [&_.profile-input]:outline-none [&_.profile-input]:focus:border-primary"',
    'className="[&_.profile-input]:w-full [&_.profile-input]:min-h-14 [&_.profile-input]:rounded-2xl [&_.profile-input]:border [&_.profile-input]:border-[#D6DBE2] [&_.profile-input]:bg-white [&_.profile-input]:py-4 [&_.profile-input]:pl-12 [&_.profile-input]:pr-4 [&_.profile-input]:text-[#111827] [&_.profile-input]:placeholder:text-[#788391] [&_.profile-input]:outline-none [&_.profile-input]:focus:border-primary [&_.profile-input]:focus:ring-2 [&_.profile-input]:focus:ring-[#E51B23]/10"',
    'campos de texto legiveis');
  change('className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5"',
    'className="rounded-3xl border border-[#F1D2D5] bg-white p-5"',
    'cartao seguranca');
  change('className="font-black text-red-300"','className="font-black text-[#B91C1C]"','titulo desativar');
  change('className="mt-4 h-11 w-full rounded-xl border border-red-500/30 bg-red-500/10 text-sm font-black text-red-300"',
    'className="mt-4 h-11 w-full rounded-xl border border-[#F1D2D5] bg-[#FFF1F2] text-sm font-black text-[#B91C1C]"',
    'acao desativar');
  source=source.replace('      <main className=', '      {/* '+marker+': contraste e safe area mobile */}\n      <main className=');
}
for(const required of [marker,'[&_.profile-input]:bg-white','[&_.profile-input]:text-[#111827]','pb-[calc(env(safe-area-inset-bottom)+9rem)]','onSubmit={handleSave}','supabase.auth.updateUser(']){
  if(!source.includes(required))throw Error('[FAIL] Perfil Entregas: requisito '+required);
}
if(source!==before)writeFileSync(file,source,'utf8');
console.log('[OK] APOIS Entregas Dados Pessoais: campos brancos, texto escuro e salvar visivel acima da navegação.');
