import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const base=resolve(process.env.APOIS_ENTREGAS_WORKSPACE||'.work/partner-entregador');
function edit(path,fn){const full=resolve(base,path);const before=readFileSync(full,'utf8');const after=fn(before);if(after===before){console.log('[OK] já aplicado '+path);return;}writeFileSync(full,after,'utf8');}
const logoImport='import { APOIS_PARTNER_LOGO_DATA_URL } from "@/assets/apoisPartnerLogoData";';
// Não alterar handlers OAuth nem formulários. Apenas temas locais da tela e imagem.
edit('src/routes/register.tsx',s=>{
  if(!s.includes('src={logoAsset.url}'))throw Error('[FAIL] logo registro');
  s=s.replace('src={logoAsset.url}','src={APOIS_PARTNER_LOGO_DATA_URL}').replace('alt="APOIS ENTREGA"','alt="APOIS"');
  if(!s.includes(logoImport))s=logoImport+'\n'+s;
  s=s.replace('bg-black text-white','bg-[#F7F7F8] text-[#111827]').replace('items-center bg-black px-4','items-center bg-[#F7F7F8] px-4');
  s=s.replace('bg-zinc-900/50 border-zinc-800 h-11 rounded-xl text-white text-sm placeholder:text-zinc-600','bg-white border-[#D9DDE3] h-11 rounded-xl text-[#111827] text-sm placeholder:text-[#7A8491]');
  s=s.replaceAll('text-zinc-500','text-[#596372]').replaceAll('text-zinc-400','text-[#4B5563]');
  s=s.replaceAll('text-white','text-[#111827]').replaceAll('text-black','text-[#111827]');
  s=s.replace('bg-primary text-base font-bold text-[#111827]','bg-[#E51B23] text-base font-bold text-white');
  s=s.replace('onClick={() => navigate({ to: "/" })}','onClick={() => window.location.replace("../../index.html")}');
  if(!s.includes('src={APOIS_PARTNER_LOGO_DATA_URL}'))throw Error('[FAIL] imagem registro');
  return s;
});
edit('src/routes/login.tsx',s=>{
  const anchor='className="mt-2 rounded-[28px] border border-[#E2E5EA] bg-white';
  // Visual original após o patch v17 ainda conserva classes escuras; a correção é restrita à tela.
  const start=s.indexOf('export default'); // não depender de export específico
  s=s.replaceAll('className="mt-2 rounded-[28px] border border-[#E2E5EA] bg-white','className="mt-2 rounded-[28px] border border-[#E2E5EA] bg-white');
  s=s.replaceAll('bg-[#090909]/94','bg-white').replaceAll('bg-[#111111]','bg-white');
  s=s.replaceAll('text-[#111827]">Entrar na sua','text-[#111827]">Entrar na sua');
  // Overrides apenas do container de login e elementos de texto herdados
  const marker='data-apois-partner-auth-v17';
  if(!s.includes(marker))throw Error('[FAIL] visual v17 esperado');
  s=s.replace(marker,marker+' data-apois-courier-login-v2');
  return s;
});
const css=resolve(base,'src/system-theme.css');
let c=readFileSync(css,'utf8');
if(!c.includes('APOIS_COURIER_LOGIN_CONTRAST_V2'))c+=`\n/* APOIS_COURIER_LOGIN_CONTRAST_V2 */\n[data-apois-courier-login-v2] { color:#111827 !important; background:#F7F7F8 !important; }\n[data-apois-courier-login-v2] h1,[data-apois-courier-login-v2] h2,[data-apois-courier-login-v2] label { color:#111827 !important; }
[data-apois-courier-login-v2] [class*="rounded-[28px]"],[data-apois-courier-login-v2] [class*="rounded-[2rem]"] { background-color:#FFFFFF !important; border-color:#E5E7EB !important; }
[data-apois-courier-login-v2] [class*="text-zinc-"] { color:#596372 !important; }\n[data-apois-courier-login-v2] p { color:#596372 !important; }\n[data-apois-courier-login-v2] input { color:#111827 !important; -webkit-text-fill-color:#111827 !important; background:#FFFFFF !important; }\n[data-apois-courier-login-v2] input::placeholder { color:#7A8491 !important; -webkit-text-fill-color:#7A8491 !important; }\n`;
writeFileSync(css,c,'utf8');
console.log('[OK] Entregador: formulário claro, logo incorporada e login legível.');

// Etapa efetiva pós-Google: formulário de CPF, data de nascimento e veículo.
edit('src/components/CourierPremiumViews.tsx',source=>{
  if(!source.includes('export function CourierApplication('))throw Error('[FAIL] cadastro pós-Google não identificado');
  if(!source.includes(logoImport))source=logoImport+'\n'+source;
  const begin=source.indexOf('export function CourierApplication(');
  const end=source.indexOf('export function CourierReviewState(',begin);
  if(begin<0||end<0)throw Error('[FAIL] delimitação cadastro do Entregador');
  let form=source.slice(begin,end);
  // Importações adicionadas somente DEPOIS de recompor a seção: alterar o
  // prefixo antes de slice(begin,end) deslocava os índices e corrompia TSX.
  const hookAnchor='  const [vehicleType, setVehicleType] = useState("moto");';
  if(!form.includes(hookAnchor))throw Error('[FAIL] cadastro sem state');
  form=form.replace(hookAnchor,hookAnchor+'\n  useEffect(() => { try { if (localStorage.getItem("apois-parceiro:operational-role") === "entregador") localStorage.removeItem("apois-parceiro:operational-role"); } catch { /* storage indisponível */ } }, []);');

  // Caso o Google tenha autenticado alguém sem cadastro, reabrir o app
  // depois de ficar em segundo plano deve exibir o seletor de parceiros.
  // Não se aplica aos entregadores cadastrados: este componente só existe sem courier.
  const stateAnchor='  const motorized = vehicleType === "moto" || vehicleType === "carro";';
  if(!form.includes(stateAnchor))throw Error('[FAIL] ancora de ciclo de vida do cadastro Entregador');
  form=form.replace(stateAnchor,stateAnchor+`\n  // APOIS_COURIER_INCOMPLETE_RESUME_V1
  useEffect(() => {
    if (!CourierCapacitor.isNativePlatform()) return;
    let pausedAt = 0;
    let disposed = false;
    let pauseHandler: { remove: () => Promise<void> } | null = null;
    let resumeHandler: { remove: () => Promise<void> } | null = null;
    void CourierAppLifecycle.addListener("pause", () => { pausedAt = Date.now(); }).then((handle) => {
      if (disposed) void handle.remove(); else pauseHandler = handle;
    });
    void CourierAppLifecycle.addListener("resume", () => {
      if (disposed || !pausedAt || Date.now() - pausedAt < 3000) return;
      pausedAt = 0;
      try { if (localStorage.getItem("apois-parceiro:operational-role") === "entregador") localStorage.removeItem("apois-parceiro:operational-role"); } catch {}
      window.location.replace("../../index.html");
    }).then((handle) => {
      if (disposed) void handle.remove(); else resumeHandler = handle;
    });
    return () => { disposed = true; void pauseHandler?.remove(); void resumeHandler?.remove(); };
  }, []);`);
  form=form.replace('src={logoAsset.url}','src={APOIS_PARTNER_LOGO_DATA_URL}').replace('alt="APOIS ENTREGA"','alt="APOIS"');
  form=form.replaceAll('bg-black','bg-[#F7F7F8]').replaceAll('bg-zinc-950/85','bg-white').replaceAll('bg-zinc-950','bg-white');
  form=form.replaceAll('text-white','text-[#111827]').replaceAll('text-zinc-400','text-[#596372]').replaceAll('text-zinc-300','text-[#374151]').replaceAll('text-zinc-600','text-[#596372]');
  form=form.replace('linear-gradient(145deg,#111,#070707)','linear-gradient(145deg,#FFFFFF,#FFF1F2)');
  form=form.replace('border-zinc-800','border-[#E5E7EB]');
  form=form.replace('shadow-[0_20px_55px_rgba(0,0,0,0.42)]','shadow-[0_18px_42px_-24px_rgba(17,24,39,0.18)]');
  if(!form.includes('src={APOIS_PARTNER_LOGO_DATA_URL}'))throw Error('[FAIL] logo de cadastro não corrigida');
  source=source.slice(0,begin)+form+source.slice(end);
  if (!/import\s*\{[^}]*\buseEffect\b[^}]*\}\s*from\s*["']react["']/.test(source)) {
    source='import { useEffect } from "react";\n'+source;
  }
  if(!source.includes('import { App as CourierAppLifecycle } from "@capacitor/app";')){
    source='import { App as CourierAppLifecycle } from "@capacitor/app";\nimport { Capacitor as CourierCapacitor } from "@capacitor/core";\n'+source;
  }

  const input='className="h-14 w-full rounded-2xl border border-zinc-800 bg-black/70 px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-primary focus:ring-2 focus:ring-primary/10"';
  // O tema v17 pode já ter normalizado o campo; nesse caso não é erro.
  if(source.includes(input))source=source.replace(input,'className="h-14 w-full rounded-2xl border border-[#D9DDE3] bg-white px-4 text-sm text-[#111827] outline-none transition placeholder:text-[#6B7280] focus:border-primary focus:ring-2 focus:ring-primary/10"');
  return source;
});

edit('src/routes/courier.tsx',source=>{
  const anchor='onBack={() => void logout()}';
  // O hardening de navegação anterior pode reescrever o handler de retorno. Não falhar por formato específico.
  return source.includes(anchor) ? source.replace(anchor,'onBack={() => window.location.replace("../../index.html")}') : source;
});
