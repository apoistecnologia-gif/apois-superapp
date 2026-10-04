import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const themePath = resolve(root, workspace, 'src/customer-theme.css');
const logoPath = resolve(root, workspace, 'public/apois-logo-customer.svg');

if (!existsSync(themePath)) throw new Error(`Tema do Cliente Entregas ausente: ${themePath}`);
if (!existsSync(logoPath)) throw new Error(`Logo do Cliente Entregas ausente: ${logoPath}`);

const marker = '/* APOIS_CUSTOMER_RED_V2 */';
let theme = readFileSync(themePath, 'utf8');
if (!theme.includes(marker)) {
  theme += `\n\n${marker}\n/* Identidade interna unificada com APOIS Corridas: branco + preto + vermelho.\n * Verde permanece reservado para sucesso/online; vermelho APOIS é marca/CTA e tons específicos de erro continuam semânticos. */\n.apois-customer-theme {\n  --background: oklch(0.105 0.006 85);\n  --foreground: oklch(0.985 0.002 85);\n  --card: oklch(0.15 0.006 85);\n  --card-foreground: oklch(0.985 0.002 85);\n  --popover: oklch(0.15 0.006 85);\n  --popover-foreground: oklch(0.985 0.002 85);\n  --primary: oklch(0.59 0.24 27);\n  --primary-foreground: oklch(0.99 0.002 85);\n  --secondary: oklch(0.19 0.008 85);\n  --secondary-foreground: oklch(0.95 0.004 85);\n  --muted: oklch(0.19 0.008 85);\n  --muted-foreground: oklch(0.68 0.012 85);\n  --accent: oklch(0.52 0.22 27);\n  --accent-foreground: oklch(0.99 0.002 85);\n  --border: oklch(0.27 0.012 85);\n  --input: oklch(0.23 0.01 85);\n  --ring: oklch(0.59 0.24 27);\n  --sidebar: oklch(0.135 0.006 85);\n  --sidebar-foreground: oklch(0.985 0.002 85);\n  --sidebar-primary: oklch(0.59 0.24 27);\n  --sidebar-primary-foreground: oklch(0.99 0.002 85);\n  --sidebar-accent: oklch(0.19 0.008 85);\n  --sidebar-accent-foreground: oklch(0.95 0.004 85);\n  --sidebar-border: oklch(0.27 0.012 85);\n  --sidebar-ring: oklch(0.59 0.24 27);\n}\n.apois-customer-theme body,\n.apois-customer-theme body > div,\n.apois-customer-theme [class~="bg-black"] { background-color:#F7F7F8; }\n.apois-customer-theme [class*="from-primary"][class*="to-accent"],\n.apois-customer-theme [class*="from-primary"][class*="via-primary"][class*="to-accent"] {\n  background-image:linear-gradient(135deg,#FF5A60,#E51B23 56%,#C9141B) !important;\n  color:#FFFFFF !important;\n}\n.apois-customer-theme [class*="rgba(57,181,74"],\n.apois-customer-theme [class*="rgba(106,27,154"],\n.apois-customer-theme [class*="rgba(31,120,148"],\n.apois-customer-theme [class*="rgba(53,169,201"] {\n  --tw-shadow-color:rgba(229,27,35,.26) !important;\n}\n.apois-customer-theme [class~="text-[#39B54A]"],\n.apois-customer-theme [class~="text-[#6A1B9A]"],\n.apois-customer-theme [class~="text-[#1F7894]"],\n.apois-customer-theme [class~="text-[#35A9C9]"],\n.apois-customer-theme [class~="text-[#FFD700]"],\n.apois-customer-theme [class~="text-[#F6B900]"],\n.apois-customer-theme [class~="text-[#FACC15]"] { color:#E51B23 !important; }\n.apois-customer-theme [class~="bg-[#39B54A]"],\n.apois-customer-theme [class~="bg-[#6A1B9A]"],\n.apois-customer-theme [class~="bg-[#1F7894]"],\n.apois-customer-theme [class~="bg-[#35A9C9]"],\n.apois-customer-theme [class~="bg-[#FFD700]"],\n.apois-customer-theme [class~="bg-[#F6B900]"],\n.apois-customer-theme [class~="bg-[#FACC15]"] { background-color:#E51B23 !important; color:#FFFFFF !important; }\n.apois-customer-theme [class~="border-[#39B54A]"],\n.apois-customer-theme [class~="border-[#6A1B9A]"],\n.apois-customer-theme [class~="border-[#1F7894]"],\n.apois-customer-theme [class~="border-[#35A9C9]"],\n.apois-customer-theme [class~="border-[#FFD700]"],\n.apois-customer-theme [class~="border-[#F6B900]"],\n.apois-customer-theme [class~="border-[#FACC15]"] { border-color:#E51B23 !important; }\n.apois-customer-theme input:focus,\n.apois-customer-theme textarea:focus,\n.apois-customer-theme select:focus { border-color:#E51B23; }\n.apois-customer-theme .apois-customer-card {\n  background:linear-gradient(145deg,#151515,#0b0b0b);\n  border-color:#313131;\n  box-shadow:0 12px 34px rgba(0,0,0,.42);\n}\n.apois-customer-theme .apois-customer-soft-glow { box-shadow:0 10px 30px rgba(229,27,35,.18); }\n`;
}
writeFileSync(themePath, theme, 'utf8');

let logo = readFileSync(logoPath, 'utf8');
logo = logo
  .replace('Logomarca APOIS Entregas em azul petróleo e branco sobre fundo transparente', 'Logomarca APOIS Entregas em vermelho e branco sobre fundo transparente')
  .replace('Logomarca APOIS Entregas em dourado e branco sobre fundo transparente', 'Logomarca APOIS Entregas em vermelho e branco sobre fundo transparente')
  .replaceAll('#1F7894', '#C9141B')
  .replaceAll('#1f7894', '#C9141B')
  .replaceAll('#35A9C9', '#E51B23')
  .replaceAll('#35a9c9', '#E51B23')
  .replaceAll('#C88A08', '#C9141B')
  .replaceAll('#c88a08', '#C9141B')
  .replaceAll('#F6BE1C', '#E51B23')
  .replaceAll('#f6be1c', '#E51B23');
writeFileSync(logoPath, logo, 'utf8');

const finalTheme = readFileSync(themePath, 'utf8');
const finalLogo = readFileSync(logoPath, 'utf8');
for (const required of [marker, '--primary: oklch(0.59 0.24 27)', '#E51B23', '#F7F7F8', '--tw-shadow-color:rgba(229,27,35,.26)']) {
  if (!finalTheme.includes(required)) throw new Error(`Cliente Entregas: identidade branco/preto/vermelho incompleta (${required})`);
}
for (const forbidden of ['#1F7894', '#35A9C9', '#C88A08', '#F6BE1C', 'azul petróleo', 'dourado e branco']) {
  if (finalLogo.includes(forbidden)) throw new Error(`Cliente Entregas: logo ainda contém identidade antiga (${forbidden})`);
}
if (!finalLogo.includes('#E51B23') || !finalLogo.includes('#C9141B')) {
  throw new Error('Cliente Entregas: logo vermelha não foi confirmada.');
}

// __root.tsx applies only the "apois-system-theme" class to <html> for every
// product (customer, courier, merchant, admin) — "apois-customer-theme" above
// is never actually present on any element, so patching customer-theme.css
// alone never reached the real page. system-theme.css is the file that's
// actually imported and applied; it still carries the old petrol-blue
// palette this hardener was supposed to replace. Apply the same proven
// preto+vermelho override used by harden-partner-entregador-theme.mjs.
const systemThemePath = resolve(root, workspace, 'src/system-theme.css');
if (!existsSync(systemThemePath)) throw new Error(`Tema global do Entregas ausente: ${systemThemePath}`);

const systemMarker = '/* APOIS_ENTREGAS_SYSTEM_RED_V2 */';
let systemTheme = readFileSync(systemThemePath, 'utf8');
if (!systemTheme.includes(systemMarker)) {
  systemTheme += `\n\n${systemMarker}\n/* .apois-system-theme é a classe realmente aplicada ao <html> em __root.tsx.\n * Sobrescreve a identidade petrol-blue antiga do arquivo por branco + preto + vermelho. */\n.apois-system-theme {\n  --primary: oklch(0.59 0.24 27);\n  --primary-foreground: oklch(0.99 0.002 85);\n  --accent: oklch(0.52 0.22 27);\n  --accent-foreground: oklch(0.99 0.002 85);\n  --ring: oklch(0.59 0.24 27);\n  --sidebar-primary: oklch(0.59 0.24 27);\n  --sidebar-primary-foreground: oklch(0.99 0.002 85);\n  --sidebar-ring: oklch(0.59 0.24 27);\n}\n.apois-system-theme [class*="from-primary"][class*="to-accent"],\n.apois-system-theme [class*="from-primary"][class*="via-primary"][class*="to-accent"] {\n  background-image: linear-gradient(135deg, #E51B23, #C9141B) !important;\n  color: #FFFFFF !important;\n}\n.apois-system-theme [class*="rgba(57,181,74"],\n.apois-system-theme [class*="rgba(106,27,154"] {\n  --tw-shadow-color: rgba(229,27,35,.26) !important;\n}\n.apois-system-theme [class~="text-[#39B54A]"],\n.apois-system-theme [class~="text-[#6A1B9A]"],\n.apois-system-theme [class~="text-[#FFD700]"],\n.apois-system-theme [class~="text-[#F6B900]"],\n.apois-system-theme [class~="text-[#FACC15]"] { color: #E51B23 !important; }\n.apois-system-theme [class~="bg-[#39B54A]"],\n.apois-system-theme [class~="bg-[#6A1B9A]"],\n.apois-system-theme [class~="bg-[#FFD700]"],\n.apois-system-theme [class~="bg-[#F6B900]"],\n.apois-system-theme [class~="bg-[#FACC15]"] { background-color: #E51B23 !important; color: #FFFFFF !important; }\n.apois-system-theme [class~="border-[#39B54A]"],\n.apois-system-theme [class~="border-[#6A1B9A]"],\n.apois-system-theme [class~="border-[#FFD700]"],\n.apois-system-theme [class~="border-[#F6B900]"],\n.apois-system-theme [class~="border-[#FACC15]"] { border-color: #E51B23 !important; }\n.apois-system-theme input:focus,\n.apois-system-theme textarea:focus,\n.apois-system-theme select:focus { border-color: #E51B23; }\n`;
}
writeFileSync(systemThemePath, systemTheme, 'utf8');

const finalSystemTheme = readFileSync(systemThemePath, 'utf8');
for (const required of [systemMarker, '--primary: oklch(0.59 0.24 27)', '#E51B23']) {
  if (!finalSystemTheme.includes(required)) {
    throw new Error(`Entregas: identidade branco/preto/vermelho do tema global incompleta (${required})`);
  }
}

console.log('[OK] Cliente Entregas: telas internas, componentes, sombras e logo seguem identidade APOIS branco + preto + vermelho.');
console.log('[OK] Entregas: system-theme.css (classe realmente aplicada ao <html>) segue identidade APOIS branco + preto + vermelho.');

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`${label}: padrão esperado não encontrado`);
  return source.replaceAll(search, replacement);
}

// Tela transitória de "sessão expirada" do Painel do Estabelecimento (servida
// como HTML bruto por server.ts, fora do bundle React) ainda usava as cores
// antigas roxo/verde da marca, sem passar por nenhum tema CSS.
const serverPath = resolve(root, workspace, 'src/server.ts');
if (!existsSync(serverPath)) throw new Error(`server.ts do Entregas ausente: ${serverPath}`);
let serverSource = readFileSync(serverPath, 'utf8');
serverSource = serverSource
  .replaceAll('.brand{color:#6A1B9A;', '.brand{color:#E51B23;')
  .replaceAll('.brand{color:#6a1b9a;', '.brand{color:#E51B23;')
  .replaceAll('.brand{color:#f6be1c;', '.brand{color:#E51B23;')
  .replaceAll('.brand{color:#F6BE1C;', '.brand{color:#E51B23;')
  .replaceAll('margin:10px auto 0;background:#39B54A}', 'margin:10px auto 0;background:#C9141B}')
  .replaceAll('margin:10px auto 0;background:#39b54a}', 'margin:10px auto 0;background:#C9141B}')
  .replaceAll('margin:10px auto 0;background:#c88a08}', 'margin:10px auto 0;background:#C9141B}')
  .replaceAll('margin:10px auto 0;background:#C88A08}', 'margin:10px auto 0;background:#C9141B}');
if (!serverSource.includes('.brand{color:#E51B23;')) {
  throw new Error('server.ts: marca vermelha da tela de sessão expirada não foi confirmada');
}
if (!serverSource.includes('background:#C9141B}')) {
  throw new Error('server.ts: sublinhado vermelho da tela de sessão expirada não foi confirmado');
}
writeFileSync(serverPath, serverSource, 'utf8');

const finalServerSource = readFileSync(serverPath, 'utf8');
for (const forbidden of ['#6A1B9A', '#39B54A', '#f6be1c', '#F6BE1C', '#c88a08', '#C88A08']) {
  if (finalServerSource.includes(forbidden)) {
    throw new Error(`server.ts: identidade antiga ainda presente na tela de sessão expirada (${forbidden})`);
  }
}

// Login do Painel do Estabelecimento/Admin (branch padrão de Login(), não a
// branch "courier"): o brilho atrás do botão "Entrar" usava um rgba() verde
// literal, que não é afetado pela troca de --primary/--accent porque o valor
// já vem hardcoded dentro do shadow arbitrário do Tailwind.
const loginPath = resolve(root, workspace, 'src/routes/login.tsx');
if (!existsSync(loginPath)) throw new Error(`login.tsx do Entregas ausente: ${loginPath}`);
let loginSource = readFileSync(loginPath, 'utf8');

// APOIS_CUSTOMER_LOGIN_LIGHT_V3
// Corrige apenas a apresentação do login do Cliente no workspace descartável.
// O fluxo handleLogin, reset, Google OAuth, cadastro e isolamento de sessão não é reimplementado.
if (!loginSource.includes('import apoisClientBrand from "@/assets/apois-client-red-logo.png";')) {
  loginSource = loginSource.replace(
    'import logoAsset from "@/assets/logo.png.asset.json";',
    'import logoAsset from "@/assets/logo.png.asset.json";\nimport apoisClientBrand from "@/assets/apois-client-red-logo.png";',
  );
}
loginSource = loginSource
  .replace(
    '<div className="min-h-dvh w-full overflow-y-auto bg-black text-white">',
    '<div data-apois-customer-login-red-v3 className="min-h-dvh w-full overflow-y-auto bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F8_58%,#FFF1F2_100%)] text-[#111111]">',
  )
  .replace(
    'className="-ml-2 rounded-full p-2 transition-colors hover:bg-white/10"\n          aria-label="Voltar"\n        >\n          <ChevronLeft className="h-5 w-5 text-white" />',
    'className="-ml-2 grid h-11 w-11 place-items-center rounded-full border border-[#E2E4E8] bg-white text-[#111111] shadow-sm transition-colors active:bg-[#FFF1F2]"\n          aria-label="Voltar"\n        >\n          <ChevronLeft className="h-5 w-5 text-[#111111]" />',
  )
  .replace(
    'className="mx-auto flex w-full max-w-md flex-col px-6 pb-[max(env(safe-area-inset-bottom),2rem)] pt-8"',
    'className="mx-auto flex w-full max-w-md flex-col px-5 pb-[max(env(safe-area-inset-bottom),2rem)] pt-3"',
  )
  .replace(
    '            src={logoAsset.url}\n            alt="APOIS ENTREGA"\n            className="mb-5 h-20 w-auto object-contain"',
    '            src={apoisClientBrand}\n            alt="APOIS"\n            className="mb-4 h-28 w-28 object-contain"',
  )
  .replace(
    'className="text-sm font-black uppercase tracking-[0.24em] text-accent"',
    'className="text-xs font-black uppercase tracking-[0.24em] text-[#E51B23]"',
  )
  .replace(
    'className="mt-3 text-3xl font-black leading-tight text-white"',
    'className="mt-2 text-3xl font-black leading-tight text-[#111111]"',
  )
  .replace(
    'className="mt-10 space-y-5"',
    'className="mt-6 space-y-5 rounded-[28px] border border-[#E2E4E8] bg-white p-5 shadow-[0_18px_55px_rgba(17,17,17,0.10)]"',
  )
  .replaceAll(
    'className="ml-1 text-sm font-medium text-zinc-400"',
    'className="ml-1 text-sm font-bold text-[#555B63]"',
  )
  .replace(
    'className="h-14 rounded-2xl border-zinc-800 bg-zinc-900/50 px-4 text-base text-white placeholder:text-zinc-600 focus:border-accent focus:ring-accent"',
    'className="h-14 rounded-2xl border-[#E2E4E8] bg-[#F7F7F8] px-4 text-base text-[#111111] placeholder:text-[#9CA1A9] focus:border-[#E51B23] focus:ring-[#E51B23]"',
  )
  .replace(
    'className="h-14 rounded-2xl border-zinc-800 bg-zinc-900/50 px-4 pr-12 text-base text-white placeholder:text-zinc-600 focus:border-accent focus:ring-accent"',
    'className="h-14 rounded-2xl border-[#E2E4E8] bg-[#F7F7F8] px-4 pr-12 text-base text-[#111111] placeholder:text-[#9CA1A9] focus:border-[#E51B23] focus:ring-[#E51B23]"',
  )
  .replace(
    'className="text-sm font-bold text-primary hover:underline disabled:opacity-50"',
    'className="inline-flex min-h-11 items-center rounded-xl px-2 text-sm font-bold text-[#E51B23] hover:bg-[#FFF1F2] disabled:opacity-50"',
  )
  .replace(
    'className="h-14 w-full rounded-2xl bg-gradient-to-r from-primary to-accent text-lg font-black text-white shadow-[0_12px_35px_rgba(200,138,8,0.18)] transition-transform hover:opacity-95 active:scale-[0.98]"',
    'className="h-14 w-full rounded-2xl bg-[#E51B23] text-lg font-black text-white shadow-[0_12px_32px_rgba(229,27,35,0.22)] transition-transform hover:bg-[#C9141B] active:scale-[0.98]"',
  )
  .replaceAll(
    'data-apois-google-login-after-form className="mt-3"',
    'data-apois-google-login-after-form className="mt-3 rounded-[18px] border border-[#E2E4E8] bg-white shadow-sm"',
  );

for (const required of [
  'data-apois-customer-login-red-v3',
  'src={apoisClientBrand}',
  'bg-[linear-gradient(180deg,#FFFFFF_0%,#FFF8F8_58%,#FFF1F2_100%)]',
  '<GoogleLoginButton />',
  'Esqueci minha senha',
  'Criar minha conta',
]) {
  if (!loginSource.includes(required)) throw new Error(`login.tsx: visual claro do Cliente incompleto (${required})`);
}
loginSource = loginSource
  .replaceAll('shadow-[0_12px_35px_rgba(57,181,74,0.18)]', 'shadow-[0_12px_35px_rgba(201,20,27,0.18)]')
  .replaceAll('shadow-[0_12px_35px_rgba(200,138,8,0.18)]', 'shadow-[0_12px_35px_rgba(201,20,27,0.18)]')
  .replaceAll('shadow-[0_12px_35px_rgba(246,190,28,0.22),0_0_30px_rgba(200,138,8,0.15)]', 'shadow-[0_12px_35px_rgba(229,27,35,0.22),0_0_30px_rgba(201,20,27,0.15)]');
if (!loginSource.includes('rgba(201,20,27,0.18)') && !loginSource.includes('rgba(229,27,35,0.22)')) {
  throw new Error('login.tsx: brilho vermelho do botão Entrar não foi confirmado');
}
writeFileSync(loginPath, loginSource, 'utf8');

const finalLoginSource = readFileSync(loginPath, 'utf8');
if (
  finalLoginSource.includes('rgba(57,181,74,0.18)') ||
  finalLoginSource.includes('rgba(200,138,8,0.18)') ||
  finalLoginSource.includes('rgba(246,190,28,0.22)')
) {
  throw new Error('login.tsx: brilho legado verde/dourado ainda presente no botão Entrar');
}

// Badge de status "Em atendimento" do painel Admin (chamados de suporte)
// era o único estado fora da paleta branco/preto/vermelho/âmbar/esmeralda já usada
// pelos demais estados (open/resolved/closed).
const adminSupportPath = resolve(root, workspace, 'src/components/AdminSupportPanel.tsx');
if (!existsSync(adminSupportPath)) throw new Error(`AdminSupportPanel.tsx do Entregas ausente: ${adminSupportPath}`);
let adminSupportSource = readFileSync(adminSupportPath, 'utf8');
if (adminSupportSource.includes('in_progress: "bg-blue-500/10 text-blue-300",')) {
  adminSupportSource = adminSupportSource.replace(
    'in_progress: "bg-blue-500/10 text-blue-300",',
    'in_progress: "bg-primary/10 text-primary",',
  );
}
if (!adminSupportSource.includes('in_progress: "bg-primary/10 text-primary",')) {
  throw new Error('AdminSupportPanel.tsx: badge "Em atendimento" não usa identidade APOIS');
}
writeFileSync(adminSupportPath, adminSupportSource, 'utf8');

const finalAdminSupportSource = readFileSync(adminSupportPath, 'utf8');
if (finalAdminSupportSource.includes('text-blue-300') || finalAdminSupportSource.includes('bg-blue-500')) {
  throw new Error('AdminSupportPanel.tsx: badge "Em atendimento" ainda usa azul');
}

console.log('[OK] Estabelecimento: tela de sessão expirada (server.ts) segue identidade APOIS branco + preto + vermelho.');
console.log('[OK] Estabelecimento/Admin: brilho do botão Entrar em login.tsx segue identidade APOIS branco + preto + vermelho.');
console.log('[OK] Admin: badge "Em atendimento" do painel de suporte segue identidade APOIS.');
