import {readFileSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
const root=resolve(".work/partner-motorista");
function edit(file,changes){
 const p=resolve(root,file);let s=readFileSync(p,"utf8");
 for(const [from,to,why] of changes){const n=s.split(from).length-1;if(n!==1)throw Error("[FAIL] Motorista visual "+file+" "+why+" occurrences="+n);s=s.replace(from,to)}
 writeFileSync(p,s,"utf8");
}
edit("src/routes/motorista.ganhos.tsx",[
 ['<div className="min-h-[100dvh] min-w-0 bg-[#050607] text-white">','<div data-apois-driver-finance-contrast-v1 className="min-h-[100dvh] min-w-0 bg-[#F7F7F8] text-[#111827]">',"finance root"],
 ['<section className="min-w-0 rounded-[28px] border border-[#F6BE1C]/20 bg-gradient-to-br from-[#2A2108] via-[#121416] to-[#090A0B] p-4 sm:p-5"','<section className="min-w-0 rounded-[28px] border border-[#E51B23]/20 bg-gradient-to-br from-[#27202A] via-[#121416] to-[#090A0B] p-4 text-white sm:p-5"',"dark finance hero"],
 ['className="break-words text-[11px] font-black uppercase tracking-[0.13em] text-zinc-500">Saldo disponível','className="break-words text-[11px] font-black uppercase tracking-[0.13em] text-zinc-200">Saldo disponível',"finance label"],
 ['<div className="min-w-0 rounded-2xl border border-white/6 bg-black/20 p-3"><p className="break-words text-[11px] font-black uppercase tracking-[0.12em] text-zinc-600">','<div className="min-w-0 rounded-2xl border border-[#D9DDE3] bg-white p-3 text-[#111827]"><p className="break-words text-[11px] font-black uppercase tracking-[0.12em] text-[#596372]">',"finance metric background"],
 ['danger ? "text-red-400" : "text-zinc-200"','danger ? "text-red-700" : "text-[#111827]"',"finance metric values"],
]);
edit("src/routes/motorista.notificacoes.tsx",[
 ['<div className="relative min-h-[100dvh] min-w-0 overflow-x-hidden bg-[#050607] text-white">','<div data-apois-driver-notice-contrast-v1 className="relative min-h-[100dvh] min-w-0 overflow-x-hidden bg-[#F7F7F8] text-[#111827]">',"notice root"],
 ['<section className="relative mb-5 min-w-0 overflow-hidden rounded-[32px] border border-[#F6BE1C]/20 bg-gradient-to-br from-[#211A08] via-[#101214] to-[#08090A] p-4','<section className="relative mb-5 min-w-0 overflow-hidden rounded-[32px] border border-[#E51B23]/20 bg-gradient-to-br from-[#271A20] via-[#101214] to-[#08090A] p-4 text-white',"notice hero contrast"],
 ['<h1 className="mt-1 break-words text-[22px] font-black leading-tight tracking-[-0.035em]">Notificações</h1>','<h1 className="mt-1 break-words text-[22px] font-black leading-tight tracking-[-0.035em] text-white">Notificações</h1>',"notice header"],
 ['<p className="min-w-0 break-words text-[11px] font-semibold leading-4 text-zinc-500">','<p className="min-w-0 break-words text-[11px] font-semibold leading-4 text-zinc-200">',"unread line"],
 ['<p className="break-words text-[13px] font-black leading-5 text-white [overflow-wrap:anywhere]">','<p className="break-words text-[13px] font-black leading-5 text-white [overflow-wrap:anywhere]">',"notice item title unchanged"]
].filter(x=>x[0]!==x[1]));
edit("src/components/profile/DriverProfessionalProfileDialog.tsx",[
 ['className="max-h-[92dvh] w-[calc(100vw-24px)] max-w-md min-w-0 overflow-y-auto overscroll-contain bg-card p-4 sm:w-[calc(100vw-32px)] sm:p-6"','className="max-h-[min(78dvh,680px)] w-[calc(100vw-32px)] max-w-md min-w-0 overflow-y-auto overscroll-contain rounded-3xl border border-[#D9DDE3] bg-white p-5 text-[#111827] shadow-2xl sm:p-6"',"dialog geometry"],
 ['className="break-words pr-8 text-center text-[15px] font-bold leading-5 tracking-tight"','className="break-words pr-8 text-center text-[16px] font-bold leading-5 tracking-tight text-[#111827]"',"dialog heading"]
]);
console.log("[OK] APOIS Motorista QA: Financeiro, notificações and profile dialog contrast/geometry fixed; no APK build.");
