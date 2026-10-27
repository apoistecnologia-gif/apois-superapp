import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||".work/partner-motorista");
const path=resolve(root,"src/routes/motorista.perfil.tsx");
let source=readFileSync(path,"utf8");
const replacements=[
  ['<div className="flex min-h-dvh flex-col bg-background">','<div data-apois-driver-profile-v2 className="flex min-h-dvh flex-col bg-[#F7F7F8] text-[#111827]">'],
  ['<HeadingL className="max-w-full truncate">{name}</HeadingL>','<HeadingL className="max-w-full truncate text-[#111827]">{name}</HeadingL>'],
  ['<div className="flex items-center gap-3 text-muted-foreground">','<div className="flex items-center gap-3 text-[#626B78]">'],
  ['<span className="inline-flex items-center gap-1 text-foreground">','<span className="inline-flex items-center gap-1 text-[#111827]">'],
  ['<DSCard className="relative overflow-hidden p-5 sm:p-6 animate-fade-in">','<DSCard className="relative overflow-hidden border border-[#E5E7EB] bg-white p-5 text-[#111827] shadow-sm sm:p-6 animate-fade-in">'],
  ['<DSCard className="p-4 sm:p-5 animate-fade-in">','<DSCard className="border border-[#E5E7EB] bg-white p-4 text-[#111827] shadow-sm sm:p-5 animate-fade-in">'],
  ['"flex flex-col items-center gap-2 p-3 text-center sm:p-4",','"flex flex-col items-center gap-2 border border-[#E5E7EB] bg-white p-3 text-center text-[#111827] shadow-sm sm:p-4",'],
  ['className={cn("text-[clamp(18px,6vw,24px)] leading-none", highlight && "text-primary")}','className={cn("text-[clamp(18px,6vw,24px)] leading-none text-[#111827]", highlight && "text-[#E51B23]")}'],
  ['<Label>{label}</Label>','<Label className="text-[#626B78]">{label}</Label>'],
  ['"mt-0.5 truncate font-semibold text-foreground",','"mt-0.5 truncate font-semibold text-[#111827]",'],
  ['<div className="flex items-center gap-1.5 text-muted-foreground">','<div className="flex items-center gap-1.5 text-[#626B78]">'],
];
for(const [before,after] of replacements){if(!source.includes(before))throw Error("[FAIL] profile markup mismatch: "+before);source=source.replace(before,after);}
writeFileSync(path,source,"utf8");
console.log("[OK] Perfil Motorista: contraste legivel e cartoes brancos, sem alterar navegacao ou dados.");
