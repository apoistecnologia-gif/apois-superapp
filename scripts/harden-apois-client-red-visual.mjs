import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = process.cwd();
const workspace = resolve(root, '.work/corridas');
const RED = '#E51B23';
const RED_DARK = '#C9141B';

function file(path) { return resolve(workspace, path); }
function write(path, content) {
  const full = file(path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}
function must(path, markers) {
  const source = readFileSync(file(path), 'utf8');
  for (const marker of markers) if (!source.includes(marker)) throw new Error(`[FAIL] APOIS red visual: ${path} sem ${marker}`);
}

const brandSource = resolve(root, 'superapp/branding/apois-client-red-logo.png');
const brandTarget = file('src/assets/apois-brand.png');
mkdirSync(dirname(brandTarget), { recursive: true });
copyFileSync(brandSource, brandTarget);

const serviceAssetDir = file('src/assets/services');
mkdirSync(serviceAssetDir, { recursive: true });

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset="1" stop-color="#f1f2f4"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-opacity=".22"/></filter></defs><rect width="320" height="180" rx="28" fill="url(#g)"/>${body}</svg>`;
write('src/assets/services/car.svg', svg(`<g filter="url(#s)" transform="translate(35 52)"><path d="M25 64 43 29c5-10 14-16 26-16h112c13 0 24 7 29 19l14 32 16 8v28H9V74l16-10Z" fill="#f7f7f8" stroke="#222" stroke-width="4"/><path d="M60 32h112c8 0 13 4 17 12l9 20H43l11-21c2-6 4-11 6-11Z" fill="#cbd5df"/><path d="M116 32v32" stroke="#59616b" stroke-width="3"/><circle cx="55" cy="102" r="18" fill="#1e2228"/><circle cx="195" cy="102" r="18" fill="#1e2228"/><circle cx="55" cy="102" r="8" fill="#c7ccd2"/><circle cx="195" cy="102" r="8" fill="#c7ccd2"/><path d="M22 79h25M204 79h28" stroke="#E51B23" stroke-width="7" stroke-linecap="round"/></g>`));
write('src/assets/services/moto.svg', svg(`<g filter="url(#s)" transform="translate(55 38)"><circle cx="52" cy="95" r="31" fill="#1d2228"/><circle cx="169" cy="95" r="31" fill="#1d2228"/><circle cx="52" cy="95" r="16" fill="#c9ced4"/><circle cx="169" cy="95" r="16" fill="#c9ced4"/><path d="m55 92 35-55h52l26 58M86 49h66M116 39l-18-25H73" fill="none" stroke="#222" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M91 58h50l-18 28H73Z" fill="#E51B23"/><path d="M127 28h36" stroke="#E51B23" stroke-width="8" stroke-linecap="round"/></g>`));
write('src/assets/services/freight.svg', svg(`<g filter="url(#s)" transform="translate(26 48)"><path d="M16 24h150v72H16z" fill="#f7f7f8" stroke="#222" stroke-width="4"/><path d="M166 47h47l32 31v18h-79z" fill="#eceff2" stroke="#222" stroke-width="4"/><path d="M184 55h24l18 19h-42z" fill="#cbd5df"/><path d="M31 38h57v42H31z" fill="#E51B23"/><path d="M100 38h51v8h-51z" fill="#d2d6db"/><circle cx="55" cy="103" r="17" fill="#1e2228"/><circle cx="196" cy="103" r="17" fill="#1e2228"/><circle cx="55" cy="103" r="7" fill="#c7ccd2"/><circle cx="196" cy="103" r="7" fill="#c7ccd2"/></g>`));
write('src/assets/services/tow.svg', svg(`<g filter="url(#s)" transform="translate(28 46)"><path d="M15 58h142v43H15z" fill="#f4f5f6" stroke="#222" stroke-width="4"/><path d="M156 68h46l26 23v10h-72z" fill="#eceff2" stroke="#222" stroke-width="4"/><path d="m86 59 64-44 8 12-54 38" fill="none" stroke="#E51B23" stroke-width="10" stroke-linecap="round"/><path d="m151 18 46 27" stroke="#222" stroke-width="5"/><path d="m196 44 5 27" stroke="#222" stroke-width="5"/><circle cx="52" cy="106" r="17" fill="#1e2228"/><circle cx="188" cy="106" r="17" fill="#1e2228"/></g>`));
write('src/assets/services/delivery.svg', svg(`<g filter="url(#s)" transform="translate(45 35)"><circle cx="51" cy="102" r="28" fill="#1e2228"/><circle cx="166" cy="102" r="28" fill="#1e2228"/><circle cx="51" cy="102" r="13" fill="#c7ccd2"/><circle cx="166" cy="102" r="13" fill="#c7ccd2"/><path d="m53 100 34-52h45l32 55M84 60h64" fill="none" stroke="#222" stroke-width="9" stroke-linecap="round"/><rect x="118" y="10" width="72" height="55" rx="9" fill="#E51B23"/><path d="M134 27h40M134 39h29" stroke="#fff" stroke-width="6" stroke-linecap="round"/><path d="M91 59h43l-16 29H72z" fill="#E51B23"/></g>`));

write('src/components/pricing/CategorySelector.tsx', `import React from "react";
import { useRideCategories } from "@/hooks/use-ride-categories";
import { usePricing } from "@/hooks/use-pricing";
import { PRICING_CONFIG } from "@/services/pricing/pricing-config";
import { cn } from "@/lib/utils";
import { RideCategoryCode } from "@/types/pricing";
import carImage from "@/assets/services/car.svg";
import motoImage from "@/assets/services/moto.svg";
import freightImage from "@/assets/services/freight.svg";
import towImage from "@/assets/services/tow.svg";
import deliveryImage from "@/assets/services/delivery.svg";

const serviceImage: Record<RideCategoryCode, string> = {
  carro: carImage,
  moto: motoImage,
  fretes: freightImage,
  guincho: towImage,
  envios: deliveryImage,
};

export const CategorySelector: React.FC = () => {
  const { categories, selectedCategory, selectCategory, isLoading: categoriesLoading } = useRideCategories();
  const { estimates, status: pricingStatus } = usePricing();

  if (categoriesLoading) {
    return <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">{[1,2,3].map((i)=><div key={i} className="h-40 w-36 shrink-0 animate-pulse rounded-[22px] bg-[#F1F2F4]" />)}</div>;
  }
  if (categories.length === 0) {
    return <div className="rounded-2xl bg-[#F7F7F8] px-4 py-5 text-center text-sm text-[#666B73]">Não há categorias disponíveis para esta rota no momento.</div>;
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
      {categories.map((cat) => {
        const isSelected = selectedCategory?.id === cat.id;
        const estimate = estimates.find((e) => e.categoryId === cat.id);
        const isAvailable = estimate?.available !== false && cat.isActive;
        const label = PRICING_CONFIG.LABELS[cat.key] || cat.name;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => isAvailable && selectCategory(cat)}
            disabled={!isAvailable}
            className={cn(
              "w-36 shrink-0 overflow-hidden rounded-[22px] border bg-white p-2.5 text-left shadow-[0_8px_24px_rgba(17,17,17,.06)] transition active:scale-[.98]",
              isSelected ? "border-[#E51B23] ring-1 ring-[#E51B23]" : "border-[#E2E4E8]",
              !isAvailable && "opacity-50 grayscale"
            )}
          >
            <div className="h-[86px] overflow-hidden rounded-[16px] bg-[#F7F7F8]">
              <img src={serviceImage[cat.key] ?? carImage} alt={label} className="h-full w-full object-contain" />
            </div>
            <div className="px-1 pb-1 pt-2">
              <div className="truncate text-[14px] font-extrabold text-[#111111]">{label}</div>
              <div className={cn("mt-0.5 text-[14px] font-black", isSelected ? "text-[#E51B23]" : "text-[#242424]")}>
                {!isAvailable ? "Indisponível" : pricingStatus === "loading" ? "Calculando..." : estimate ? PRICING_CONFIG.CURRENCY_FORMAT.format(estimate.estimatedPrice) : "..."}
              </div>
              {estimate?.estimatedPickupMinutes != null ? <div className="mt-0.5 text-xs font-medium text-[#666B73]">{estimate.estimatedPickupMinutes} min</div> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
};
`);

write('src/routes/_public.login.tsx', `import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PassengerGoogleLoginButton } from "@/components/auth/PassengerGoogleLoginButton";
import logo from "@/assets/apois-brand.png";

export const Route = createFileRoute("/_public/login")({ component: LoginPage });
const friendlyLoginError = (message: string) => {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (normalized.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (normalized.includes("fetch") || normalized.includes("network")) return "Falha de conexão com o servidor. Verifique a internet e tente novamente.";
  if (normalized.includes("rate limit") || normalized.includes("too many")) return "Muitas tentativas seguidas. Aguarde um pouco e tente novamente.";
  return "Não foi possível entrar agora. Tente novamente em instantes.";
};

function LoginPage() {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [showPassword,setShowPassword]=useState(false);
  const [loading,setLoading]=useState(false);
  const navigate=useNavigate();
  const { authState }=useAuth();
  const normalizedEmail=useMemo(()=>email.trim().toLowerCase(),[email]);

  useEffect(()=>{ if(authState==="authenticated") void navigate({to:"/inicio",replace:true}); },[authState,navigate]);

  const handleLogin=async(event:React.FormEvent)=>{
    event.preventDefault(); if(loading)return;
    if(!/^\\S+@\\S+\\.\\S+$/.test(normalizedEmail)||!password){ toast.error("Preencha um e-mail válido e sua senha."); return; }
    setLoading(true);
    try{
      const {data,error}=await supabase.auth.signInWithPassword({email:normalizedEmail,password});
      if(error){
        const {data:existing}=await supabase.auth.getSession();
        if(existing.session?.user){ window.location.replace("./index.html#/inicio"); return; }
        toast.error(friendlyLoginError(error.message)); return;
      }
      if(!data.session?.user){ toast.error("O servidor não iniciou sua sessão. Tente novamente."); return; }
      toast.success("Login realizado com sucesso!");
      window.location.replace("./index.html#/inicio"); return;
    }catch(error){
      const {data:existing}=await supabase.auth.getSession();
      if(existing.session?.user){ window.location.replace("./index.html#/inicio"); return; }
      console.error("[Login] unexpected failure",{message:error instanceof Error?error.message:"unknown_error"});
      toast.error("Falha de conexão com o servidor. Tente novamente.");
    }finally{setLoading(false);}
  };

  return (
    <div className="relative min-h-[100dvh] flex-1 overflow-hidden bg-[#F7F7F8] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(22px,env(safe-area-inset-top))] text-[#111]">
      <div className="pointer-events-none absolute -right-20 -top-16 h-52 w-64 rotate-12 rounded-[45%] bg-[#E51B23]" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-96 -rotate-12 rounded-[45%] bg-[#E51B23]" />
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-[430px] flex-col">
        <div className="mb-5 mt-4 flex justify-center"><img src={logo} alt="APOIS" className="h-28 w-56 object-contain" /></div>
        <div className="mb-6 text-center">
          <h1 className="text-[34px] font-black leading-tight tracking-[-.04em]">Entrar na sua <span className="text-[#E51B23]">conta</span></h1>
          <p className="mx-auto mt-2 max-w-[330px] text-[16px] font-medium leading-snug text-[#666B73]">Acesse com e-mail e senha ou continue com sua conta Google.</p>
        </div>
        <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(17,17,17,.10)] backdrop-blur">
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="mb-2 block text-[15px] font-extrabold">E-mail</label>
              <div className="relative"><Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#666B73]" /><Input id="login-email" type="email" inputMode="email" autoCapitalize="none" placeholder="seu@email.com" value={email} onChange={(e)=>setEmail(e.target.value)} disabled={loading} autoComplete="email" className="h-14 rounded-2xl border-[#E2E4E8] bg-white pl-12 text-[#111] placeholder:text-[#9CA1A9] focus:border-[#E51B23] focus:ring-[#E51B23]" /></div>
            </div>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-[15px] font-extrabold">Senha</label>
              <div className="relative"><LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#666B73]" /><Input id="login-password" type={showPassword?"text":"password"} placeholder="Digite sua senha" value={password} onChange={(e)=>setPassword(e.target.value)} disabled={loading} autoComplete="current-password" className="h-14 rounded-2xl border-[#E2E4E8] bg-white pl-12 pr-12 text-[#111] placeholder:text-[#9CA1A9] focus:border-[#E51B23] focus:ring-[#E51B23]" /><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#666B73]" aria-label={showPassword?"Esconder senha":"Mostrar senha"}>{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
            </div>
            <div className="text-right"><Link to="/recuperar-senha" className="text-sm font-bold text-[#E51B23]">Esqueci minha senha</Link></div>
            <button type="submit" disabled={loading} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#E51B23] text-base font-black text-white shadow-[0_12px_28px_rgba(229,27,35,.22)] active:bg-[#C9141B] disabled:opacity-50">{loading?<Loader2 className="animate-spin"/>:<><span>Entrar</span><ChevronRight size={22}/></>}</button>
          </form>
          <div className="my-4 flex items-center gap-3 text-sm font-bold text-[#9CA1A9]"><span className="h-px flex-1 bg-[#E2E4E8]"/><span>ou</span><span className="h-px flex-1 bg-[#E2E4E8]"/></div>
          <PassengerGoogleLoginButton />
          <div className="mt-5 text-center text-sm text-[#666B73]">Ainda não tem uma conta? <Link to="/cadastro" className="font-extrabold text-[#E51B23]">Criar conta</Link></div>
        </div>
        <div className="mt-auto min-h-24" />
      </div>
    </div>
  );
}
`);

let styles = readFileSync(file('src/styles.css'),'utf8');
styles = styles
  .replace('--color-primary: #ffb800;', '--color-primary: #E51B23;')
  .replace('--color-secondary: #ff5c00;', '--color-secondary: #C9141B;')
  .replace('--color-surface: #1e1e1e;', '--color-surface: #FFFFFF;')
  .replace('--color-apois-yellow: #ffb800;', '--color-apois-yellow: #E51B23;');
if (!styles.includes('--color-apois-red:')) styles = styles.replace('--color-apois-yellow: #E51B23;', '--color-apois-yellow: #E51B23;\n  --color-apois-red: #E51B23;\n  --color-apois-red-dark: #C9141B;');
styles = styles.replace('@apply bg-black text-white antialiased overflow-x-hidden;', '@apply bg-[#F7F7F8] text-[#111111] antialiased overflow-x-hidden;');
write('src/styles.css', styles);

const homePath='src/routes/_authenticated.inicio.tsx';
let home=readFileSync(file(homePath),'utf8');
if(!home.includes('import brandLogo from "@/assets/apois-brand.png";')){
  home=home.replace('import { BottomSheet } from "@/components/ui/bottom-sheet/BottomSheet";','import { BottomSheet } from "@/components/ui/bottom-sheet/BottomSheet";\nimport brandLogo from "@/assets/apois-brand.png";');
}
home=home
 .replace('relative flex-1 bg-[#0A0D14] overflow-hidden flex flex-col','relative flex-1 bg-[#F7F7F8] overflow-hidden flex flex-col')
 .replace('bg-[#1A1D24]/80 backdrop-blur-md border border-white/5 rounded-full px-2 py-1.5 shadow-2xl flex items-center justify-between','bg-white/92 backdrop-blur-md border border-[#E2E4E8] rounded-[24px] px-3 py-2 shadow-[0_10px_30px_rgba(17,17,17,.10)] flex items-center justify-between')
 .replace('border-2 border-green-500 overflow-hidden bg-zinc-800','border-2 border-white overflow-hidden bg-[#F1F2F4] shadow-sm')
 .replace('text-white font-black text-xs','text-[#111] font-black text-xs')
 .replaceAll('text-apois-yellow','text-[#E51B23]')
 .replaceAll('bg-apois-yellow/10','bg-[#FFF1F2]')
 .replaceAll('border-apois-yellow/20','border-[#E51B23]/20')
 .replaceAll('bg-apois-yellow','bg-[#E51B23]')
 .replaceAll('shadow-apois-yellow/20','shadow-[#E51B23]/20')
 .replace('bg-gradient-to-t from-black via-[#0A0D14] to-transparent','bg-gradient-to-t from-white via-white/95 to-transparent')
 .replaceAll('text-zinc-400','text-[#666B73]')
 .replaceAll('text-zinc-500','text-[#666B73]')
 .replaceAll('text-zinc-600','text-[#9CA1A9]')
 .replaceAll('bg-[#1A1D24]','bg-white')
 .replaceAll('border-white/5','border-[#E2E4E8]')
 .replaceAll('border-white/10','border-[#E2E4E8]')
 .replaceAll('text-white','text-[#111111]');
if(!home.includes('alt="APOIS"')){
  home=home.replace('<div className="flex items-center gap-3">','<div className="flex items-center gap-3"><img src={brandLogo} alt="APOIS" className="h-9 w-24 object-contain" />',1);
}
home=home.replace('Confirmar {selectedCategory?.name || "Solicitação"}','Solicitar corrida');
write(homePath,home);

must('src/components/pricing/CategorySelector.tsx',['serviceImage','estimatedPickupMinutes','border-[#E51B23]']);
must('src/routes/_public.login.tsx',['PassengerGoogleLoginButton','Esqueci minha senha','Criar conta','bg-[#E51B23]']);
must('src/routes/_authenticated.inicio.tsx',['PassengerMap','Solicitar corrida','brandLogo','<CategorySelector />']);
must('src/styles.css',['--color-primary: #E51B23','--color-apois-red: #E51B23']);

console.log('[OK] APOIS Cliente Corridas: identidade vermelho/branco aplicada sem alterar autenticação, mapa, pricing ou request ride.');
