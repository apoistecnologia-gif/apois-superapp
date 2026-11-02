import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista");
function replaceOnce(s,a,b,label){
  const n=s.split(a).length-1;
  if(n!==1)throw Error("[FAIL] Contraste Motorista "+label+": "+n+" correspondências");
  return s.replace(a,b);
}
function edit(file,fn){
  const path=resolve(root,file);
  const before=readFileSync(path,"utf8");
  const after=fn(before);
  if(after===before)throw Error("[FAIL] Sem alteração visual em "+file);
  writeFileSync(path,after,"utf8");
}
edit("src/routes/motorista.ganhos.tsx",s=>{
  // Original dark shell was already converted by harden-partner-red-visual.
  s=replaceOnce(s,'<div className="min-h-[100dvh] min-w-0 bg-[#F7F7F8] text-[#111111]">',
    '<div data-apois-driver-finance-contrast-v2 className="min-h-[100dvh] min-w-0 bg-[#F7F7F8] text-[#111827]">',"finance shell");
  s=replaceOnce(s,'bg-gradient-to-br from-[#2A2108] via-[#121416] to-[#090A0B] p-4 sm:p-5',
    'bg-gradient-to-br from-[#29212A] via-[#15171C] to-[#111317] p-4 text-white sm:p-5',"dark hero foreground");
  s=replaceOnce(s,'text-[#666B73]">Ganhos registrados','text-[#E5E7EB]">Saldo disponível',"summary label");
  s=replaceOnce(s,'border border-[#E2E4E8] bg-[#F7F7F8] p-3"><p className="break-words text-[11px] font-black uppercase tracking-[0.12em] text-[#777D85]">',
    'border border-[#D9DDE3] bg-white p-3 text-[#111827]"><p className="break-words text-[11px] font-black uppercase tracking-[0.12em] text-[#596372]">',"pending cards");
  s=replaceOnce(s,'danger ? "text-red-400" : "text-zinc-200"',
    'danger ? "text-red-700" : "text-[#111827]"',"pending amounts");
  return s;
});
edit("src/routes/motorista.notificacoes.tsx",s=>{
  s=replaceOnce(s,'<div className="relative min-h-[100dvh] min-w-0 overflow-x-hidden bg-[#F7F7F8] text-[#111111]">',
    '<div data-apois-driver-notice-contrast-v2 className="relative min-h-[100dvh] min-w-0 overflow-x-hidden bg-[#F7F7F8] text-[#111827]">',"notice shell");
  s=replaceOnce(s,'bg-gradient-to-br from-[#211A08] via-[#101214] to-[#08090A] p-4',
    'bg-gradient-to-br from-[#291A21] via-[#17171C] to-[#101014] p-4 text-white',"notice hero");
  s=replaceOnce(s,'text-[#666B73]">\n                    {unread === 0',
    'text-[#E5E7EB]">\n                    {unread === 0',"unread indicator");
  s=replaceOnce(s,'? "border-white/[0.06] bg-[#0D0F11]/95"',
    '? "border-[#E2E4E8] bg-white"',"read notice light surface");
  s=replaceOnce(s,': "border-[#E51B23]/22 bg-gradient-to-br from-[#1B1607] via-[#111315] to-[#0D0F11] shadow-[0_20px_52px_-34px_rgba(229,27,35,.42)]"',
    ': "border-[#F1A3A7] bg-[#FFF7F8] shadow-[0_12px_30px_-23px_rgba(229,27,35,.25)]"',"unread notice light surface");
  s=replaceOnce(s,'font-black leading-5 text-[#111111] [overflow-wrap:anywhere]','font-black leading-5 text-[#111827] [overflow-wrap:anywhere]',"notice title");
  return s;
});
edit("src/components/profile/DriverProfessionalProfileDialog.tsx",s=>{
  s=replaceOnce(s,'className="max-h-[92dvh] w-[calc(100vw-24px)] max-w-md min-w-0 overflow-y-auto overscroll-contain bg-card p-4 sm:w-[calc(100vw-32px)] sm:p-6"',
    'className="max-h-[min(78dvh,680px)] w-[calc(100vw-32px)] max-w-md min-w-0 overflow-y-auto overscroll-contain rounded-3xl border border-[#D9DDE3] bg-white p-5 text-[#111827] shadow-2xl sm:p-6',"modal geometry");
  s=replaceOnce(s,'className="break-words pr-8 text-center text-[15px] font-bold leading-5 tracking-tight"',
    'className="break-words pr-8 text-center text-[16px] font-bold leading-5 tracking-tight text-[#111827]"',"modal title");
  return s;
});
console.log("[OK] Financeiro, notificações and perfil legíveis após a migração visual global.");
