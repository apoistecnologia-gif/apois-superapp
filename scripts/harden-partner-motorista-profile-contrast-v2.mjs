import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.env.APOIS_MOTORISTA_WORKSPACE || ".work/partner-motorista");
const path = resolve(root, "src/routes/motorista.perfil.tsx");
let source = readFileSync(path, "utf8");

// Match the PINNED Motorista source, not another repository branch.
// Preserve account loading, approval, profile editing, photo upload and logout.
const patches = [
  ['<div className="flex min-h-dvh flex-col bg-background">',
   '<div data-apois-driver-profile-v2 className="flex min-h-dvh flex-col bg-[#F7F7F8] text-[#111827]">'],
  ['<DSCard className="relative min-w-0 overflow-hidden p-4 animate-fade-in motion-reduce:animate-none sm:p-6">',
   '<DSCard className="relative min-w-0 overflow-hidden border border-[#E5E7EB] bg-white p-4 text-[#111827] shadow-sm animate-fade-in motion-reduce:animate-none sm:p-6">'],
  ['<HeadingL className="max-w-full break-words leading-tight [overflow-wrap:anywhere]">{name}</HeadingL>',
   '<HeadingL className="max-w-full break-words leading-tight text-[#111827] [overflow-wrap:anywhere]">{name}</HeadingL>'],
  ['<div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-muted-foreground">',
   '<div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[#626B78]">'],
  ['<span className="inline-flex min-w-0 items-center gap-1 text-foreground"',
   '<span className="inline-flex min-w-0 items-center gap-1 text-[#111827]"'],
  ['<DSCard className="min-w-0 p-4 animate-fade-in motion-reduce:animate-none sm:p-5">',
   '<DSCard className="min-w-0 border border-[#E5E7EB] bg-white p-4 text-[#111827] shadow-sm animate-fade-in motion-reduce:animate-none sm:p-5">'],
  ['"flex min-w-0 flex-col items-center gap-2 p-3 text-center sm:p-4"',
   '"flex min-w-0 flex-col items-center gap-2 border border-[#E5E7EB] bg-white p-3 text-center text-[#111827] shadow-sm sm:p-4"'],
  ['"max-w-full break-words text-[clamp(18px,6vw,24px)] leading-none"',
   '"max-w-full break-words text-[clamp(18px,6vw,24px)] leading-none text-[#111827]"'],
  ['<Label className="break-words text-center">{label}</Label>',
   '<Label className="break-words text-center text-[#626B78]">{label}</Label>'],
  ['<div className="flex min-w-0 items-center gap-1.5 text-muted-foreground">',
   '<div className="flex min-w-0 items-center gap-1.5 text-[#626B78]">'],
  ['"mt-0.5 break-words font-semibold text-foreground [overflow-wrap:anywhere]"',
   '"mt-0.5 break-words font-semibold text-[#111827] [overflow-wrap:anywhere]"'],
];
for(const [before,after] of patches){
  if(!source.includes(before))throw new Error("[FAIL] Pinned driver profile changed: "+before);
  source=source.replace(before,after);
}
if(!source.includes('data-apois-driver-profile-v2'))throw Error("[FAIL] profile audit marker missing");
writeFileSync(path,source,"utf8");
console.log("[OK] Motorista Perfil: legibilidade em hero, valores, documentos e dados.");
