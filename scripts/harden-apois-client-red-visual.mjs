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

// MAP_RUNTIME_PRESERVATION_V1
// A migração de identidade visual não tem autorização para alterar o runtime do mapa.
const mapRuntimeFiles = [
  'src/components/map/PassengerMap.tsx',
  'src/services/google/google-maps-loader.ts',
  'src/hooks/use-location.tsx',
  'src/services/places/places-service.ts',
];
const mapRuntimeBefore = new Map(
  mapRuntimeFiles.map((path) => [path, readFileSync(file(path), 'utf8')]),
);

const brandSource = resolve(root, 'superapp/branding/apois-client-red-logo.b64');
const brandTarget = file('src/assets/apois-brand.png');
mkdirSync(dirname(brandTarget), { recursive: true });
const brandBytes = Buffer.from(readFileSync(brandSource, 'utf8').trim(), 'base64');
if (
  brandBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
  brandBytes.length < 4096 ||
  brandBytes.readUInt32BE(16) !== 128 ||
  brandBytes.readUInt32BE(20) !== 128
) {
  throw new Error('[FAIL] APOIS red visual: logo base64 não gerou o PNG oficial 128x128');
}
writeFileSync(brandTarget, brandBytes);
write('src/assets/apoisBrandData.ts', `const apoisBrandData = "data:image/png;base64,${brandBytes.toString('base64')}";\nexport default apoisBrandData;\n`);

const serviceAssetDir = file('src/assets/services');
mkdirSync(serviceAssetDir, { recursive: true });

// APOIS_CATEGORY_VEHICLE_SPRITE_V6
// O sprite validado contém cinco veículos, nesta ordem: Carro, Moto, Fretes, Guincho, Envios.
// Os antigos arquivos *-realistic.webp estavam truncados no repositório e não são usados.
const vehicleSpriteSource = resolve(root, 'superapp/branding/categories/apois-vehicles.webp');
const vehicleSpriteBytes = readFileSync(vehicleSpriteSource);
const vehicleSpriteIsWebp =
  vehicleSpriteBytes.length >= 16 &&
  vehicleSpriteBytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
  vehicleSpriteBytes.subarray(8, 12).toString('ascii') === 'WEBP';
const vehicleSpriteDeclaredSize =
  vehicleSpriteBytes.length >= 8 ? vehicleSpriteBytes.readUInt32LE(4) + 8 : 0;
if (!vehicleSpriteIsWebp || vehicleSpriteDeclaredSize !== vehicleSpriteBytes.length) {
  throw new Error('[FAIL] APOIS red visual: sprite das categorias inválido/truncado');
}
write(
  'src/assets/categoryVehicleData.ts',
  'export const vehicleSprite = "data:image/webp;base64,' + vehicleSpriteBytes.toString('base64') + '";\n',
);
write('src/components/pricing/CategorySelector.tsx', `import React from "react";
import { useRideCategories } from "@/hooks/use-ride-categories";
import { usePricing } from "@/hooks/use-pricing";
import { PRICING_CONFIG } from "@/services/pricing/pricing-config";
import { cn } from "@/lib/utils";
import { RideCategoryCode } from "@/types/pricing";
import { vehicleSprite } from "@/assets/categoryVehicleData";

// APOIS_CATEGORY_VEHICLE_SPRITE_V6
// Ordem física do sprite validado: Carro, Moto, Fretes, Guincho, Envios.
const servicePosition: Record<string, string> = {
  carros: "0%",
  carro: "0%",
  motos: "25%",
  moto: "25%",
  fretes: "50%",
  guincho: "75%",
  envios: "100%",
};
export const CategorySelector: React.FC = () => {
  const { categories, selectedCategory, selectCategory, isLoading: categoriesLoading } = useRideCategories();
  const { estimates, status: pricingStatus } = usePricing();

  if (categoriesLoading) {
    return <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">{[1,2,3].map((i)=><div key={i} className="h-28 w-28 shrink-0 animate-pulse rounded-[18px] bg-[#F1F2F4]" />)}</div>;
  }
  if (categories.length === 0) {
    return <div className="rounded-2xl bg-[#F7F7F8] px-4 py-5 text-center text-sm text-[#666B73]">Não há categorias disponíveis para esta rota no momento.</div>;
  }

  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-hide scroll-smooth">
      {categories.map((cat) => {
        const isSelected = selectedCategory?.id === cat.id;
        const estimate = estimates.find((e) => e.categoryId === cat.id);
        const isAvailable = estimate?.available !== false && cat.isActive;
        const label = PRICING_CONFIG.LABELS[cat.key] || cat.name;
        const spritePosition = servicePosition[String(cat.key ?? cat.code ?? "").toLowerCase()] ?? servicePosition.carros;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => isAvailable && selectCategory(cat)}
            disabled={!isAvailable}
            className={cn(
              "w-[124px] shrink-0 overflow-hidden rounded-[18px] border bg-white p-2 text-left shadow-[0_8px_24px_rgba(17,17,17,.06)] transition active:scale-[.98]",
              isSelected ? "border-[#E51B23] ring-1 ring-[#E51B23]" : "border-[#E2E4E8]",
              !isAvailable && "opacity-50 grayscale"
            )}
          >
            <div
              data-apois-category-image="validated-sprite-v6"
              className="h-[84px] w-full rounded-[16px] bg-white bg-no-repeat drop-shadow-[0_7px_8px_rgba(17,17,17,.12)]"
              style={{
                backgroundImage: "url(" + vehicleSprite + ")",
                backgroundSize: "500% 100%",
                backgroundPosition: spritePosition + " center",
              }}
              role="img"
              aria-label={label}
            />
            <div className="px-0.5 pb-0.5 pt-1.5">
              <div className="truncate text-[13px] font-extrabold text-[#111111]">{label}</div>
              <div className={cn("mt-0.5 text-[12px] font-black", isSelected ? "text-[#E51B23]" : "text-[#242424]")}>
                {!isAvailable ? "Indisponível" : pricingStatus === "loading" ? "Calculando..." : estimate ? PRICING_CONFIG.CURRENCY_FORMAT.format(estimate.estimatedPrice) : "..."}
              </div>
              {estimate?.estimatedPickupMinutes != null ? <div className="mt-0.5 text-[10px] font-medium text-[#666B73]">{estimate.estimatedPickupMinutes} min</div> : null}
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
import logo from "@/assets/apoisBrandData";

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
          <h1 data-apois-client-login-title-v2 className="mx-auto max-w-[290px] pr-9 text-[30px] font-black leading-tight tracking-[-.04em] sm:max-w-none sm:pr-0 sm:text-[34px]">Entrar na sua <span className="text-[#E51B23]">conta</span></h1>
          <p className="mx-auto mt-2 max-w-[330px] text-[16px] font-medium leading-snug text-[#666B73]">Acesse com e-mail e senha ou continue com sua conta Google.</p>
        </div>
        <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_18px_55px_rgba(17,17,17,.10)] backdrop-blur">
          <form onSubmit={handleLogin} className="space-y-4" noValidate>
            <div>
              <label htmlFor="login-email" className="mb-2 block text-[15px] font-extrabold">E-mail</label>
              <div className="relative"><Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#666B73]" /><Input id="login-email" type="email" inputMode="email" autoCapitalize="none" placeholder="seu@email.com" value={email} onChange={(e)=>setEmail(e.target.value)} disabled={loading} autoComplete="email" className="h-14 rounded-2xl border-[#E2E4E8] bg-white pl-12 text-[#111] placeholder:text-[#596372] focus:border-[#E51B23] focus:ring-[#E51B23]" /></div>
            </div>
            <div>
              <label htmlFor="login-password" className="mb-2 block text-[15px] font-extrabold">Senha</label>
              <div className="relative"><LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#666B73]" /><Input id="login-password" type={showPassword?"text":"password"} placeholder="Digite sua senha" value={password} onChange={(e)=>setPassword(e.target.value)} disabled={loading} autoComplete="current-password" className="h-14 rounded-2xl border-[#E2E4E8] bg-white pl-12 pr-12 text-[#111] placeholder:text-[#596372] focus:border-[#E51B23] focus:ring-[#E51B23]" /><button type="button" onClick={()=>setShowPassword(v=>!v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-[#666B73]" aria-label={showPassword?"Esconder senha":"Mostrar senha"}>{showPassword?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
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
home=home
 .replace('  const { profile } = useAuth();','  const { profile, user } = useAuth();')
 .replace(
   '  const [isPaymentListOpen, setIsPaymentListOpen] = useState(false);',
   '  const [isPaymentListOpen, setIsPaymentListOpen] = useState(false);\n  const homeAvatarUrl = readString(profile?.avatar_url) || readString(user?.user_metadata?.avatar_url) || readString(user?.user_metadata?.picture);'
 )
 .replace(
   '{profile?.avatar_url ? (\\n                  <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />',
   '{homeAvatarUrl ? (\\n                  <img src={homeAvatarUrl} alt="Foto de perfil" className="w-full h-full object-cover" />'
 );
if(!home.includes('import brandLogo from "@/assets/apoisBrandData";')){
  home=home.replace('import { BottomSheet } from "@/components/ui/bottom-sheet/BottomSheet";','import { BottomSheet } from "@/components/ui/bottom-sheet/BottomSheet";\nimport brandLogo from "@/assets/apoisBrandData";');
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

must('src/components/pricing/CategorySelector.tsx',['servicePosition','validated-sprite-v6','estimatedPickupMinutes','border-[#E51B23]']);
must('src/routes/_public.login.tsx',['PassengerGoogleLoginButton','Esqueci minha senha','Criar conta','bg-[#E51B23]']);
must('src/routes/_authenticated.inicio.tsx',['PassengerMap','Solicitar corrida','brandLogo','<CategorySelector />','homeAvatarUrl','user?.user_metadata?.picture']);
must('src/styles.css',['--color-primary: #E51B23','--color-apois-red: #E51B23']);

for (const [path, before] of mapRuntimeBefore) {
  const after = readFileSync(file(path), 'utf8');
  if (after !== before) {
    throw new Error(`[FAIL] APOIS red visual tentou alterar runtime protegido do mapa: ${path}`);
  }
}
console.log('[OK] APOIS red visual preservou byte a byte o runtime de Maps/GPS/Places.');

console.log('[OK] APOIS Cliente Corridas: identidade vermelho/branco aplicada sem alterar autenticação, mapa, pricing ou request ride.');
