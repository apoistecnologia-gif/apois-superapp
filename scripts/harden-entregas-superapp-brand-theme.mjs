import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const themePath = resolve(root, workspace, 'src/customer-theme.css');
const logoPath = resolve(root, workspace, 'public/apois-logo-customer.svg');

if (!existsSync(themePath)) throw new Error(`Tema do Cliente Entregas ausente: ${themePath}`);
if (!existsSync(logoPath)) throw new Error(`Logo do Cliente Entregas ausente: ${logoPath}`);

const marker = '/* APOIS_CUSTOMER_GOLD_V1 */';
let theme = readFileSync(themePath, 'utf8');
if (!theme.includes(marker)) {
  theme += `\n\n${marker}\n/* Identidade interna unificada com APOIS Corridas: preto + dourado.\n * Verde permanece reservado para sucesso/online e vermelho para erro/perigo. */\n.apois-customer-theme {\n  --background: oklch(0.105 0.006 85);\n  --foreground: oklch(0.985 0.002 85);\n  --card: oklch(0.15 0.006 85);\n  --card-foreground: oklch(0.985 0.002 85);\n  --popover: oklch(0.15 0.006 85);\n  --popover-foreground: oklch(0.985 0.002 85);\n  --primary: oklch(0.82 0.16 84);\n  --primary-foreground: oklch(0.11 0.006 85);\n  --secondary: oklch(0.19 0.008 85);\n  --secondary-foreground: oklch(0.95 0.004 85);\n  --muted: oklch(0.19 0.008 85);\n  --muted-foreground: oklch(0.68 0.012 85);\n  --accent: oklch(0.72 0.145 78);\n  --accent-foreground: oklch(0.11 0.006 85);\n  --border: oklch(0.27 0.012 85);\n  --input: oklch(0.23 0.01 85);\n  --ring: oklch(0.82 0.16 84);\n  --sidebar: oklch(0.135 0.006 85);\n  --sidebar-foreground: oklch(0.985 0.002 85);\n  --sidebar-primary: oklch(0.82 0.16 84);\n  --sidebar-primary-foreground: oklch(0.11 0.006 85);\n  --sidebar-accent: oklch(0.19 0.008 85);\n  --sidebar-accent-foreground: oklch(0.95 0.004 85);\n  --sidebar-border: oklch(0.27 0.012 85);\n  --sidebar-ring: oklch(0.82 0.16 84);\n}\n.apois-customer-theme body,\n.apois-customer-theme body > div,\n.apois-customer-theme [class~="bg-black"] { background-color:#050505; }\n.apois-customer-theme [class*="from-primary"][class*="to-accent"],\n.apois-customer-theme [class*="from-primary"][class*="via-primary"][class*="to-accent"] {\n  background-image:linear-gradient(135deg,#f7ca48,#f6be1c 56%,#c88a08) !important;\n  color:#070707 !important;\n}\n.apois-customer-theme [class*="rgba(57,181,74"],\n.apois-customer-theme [class*="rgba(106,27,154"],\n.apois-customer-theme [class*="rgba(31,120,148"],\n.apois-customer-theme [class*="rgba(53,169,201"] {\n  --tw-shadow-color:rgba(246,190,28,.26) !important;\n}\n.apois-customer-theme [class~="text-[#39B54A]"],\n.apois-customer-theme [class~="text-[#6A1B9A]"],\n.apois-customer-theme [class~="text-[#1F7894]"],\n.apois-customer-theme [class~="text-[#35A9C9]"],\n.apois-customer-theme [class~="text-[#FFD700]"],\n.apois-customer-theme [class~="text-[#F6B900]"],\n.apois-customer-theme [class~="text-[#FACC15]"] { color:#f6be1c !important; }\n.apois-customer-theme [class~="bg-[#39B54A]"],\n.apois-customer-theme [class~="bg-[#6A1B9A]"],\n.apois-customer-theme [class~="bg-[#1F7894]"],\n.apois-customer-theme [class~="bg-[#35A9C9]"],\n.apois-customer-theme [class~="bg-[#FFD700]"],\n.apois-customer-theme [class~="bg-[#F6B900]"],\n.apois-customer-theme [class~="bg-[#FACC15]"] { background-color:#f6be1c !important; color:#070707 !important; }\n.apois-customer-theme [class~="border-[#39B54A]"],\n.apois-customer-theme [class~="border-[#6A1B9A]"],\n.apois-customer-theme [class~="border-[#1F7894]"],\n.apois-customer-theme [class~="border-[#35A9C9]"],\n.apois-customer-theme [class~="border-[#FFD700]"],\n.apois-customer-theme [class~="border-[#F6B900]"],\n.apois-customer-theme [class~="border-[#FACC15]"] { border-color:#f6be1c !important; }\n.apois-customer-theme input:focus,\n.apois-customer-theme textarea:focus,\n.apois-customer-theme select:focus { border-color:#f6be1c; }\n.apois-customer-theme .apois-customer-card {\n  background:linear-gradient(145deg,#151515,#0b0b0b);\n  border-color:#313131;\n  box-shadow:0 12px 34px rgba(0,0,0,.42);\n}\n.apois-customer-theme .apois-customer-soft-glow { box-shadow:0 10px 30px rgba(246,190,28,.18); }\n`;
}
writeFileSync(themePath, theme, 'utf8');

let logo = readFileSync(logoPath, 'utf8');
logo = logo
  .replace('Logomarca APOIS Entregas em azul petróleo e branco sobre fundo transparente', 'Logomarca APOIS Entregas em dourado e branco sobre fundo transparente')
  .replaceAll('#1F7894', '#C88A08')
  .replaceAll('#35A9C9', '#F6BE1C');
writeFileSync(logoPath, logo, 'utf8');

const finalTheme = readFileSync(themePath, 'utf8');
const finalLogo = readFileSync(logoPath, 'utf8');
for (const required of [marker, '--primary: oklch(0.82 0.16 84)', '#f6be1c', '#050505', '--tw-shadow-color:rgba(246,190,28,.26)']) {
  if (!finalTheme.includes(required)) throw new Error(`Cliente Entregas: identidade preto/dourado incompleta (${required})`);
}
for (const forbidden of ['#1F7894', '#35A9C9', 'azul petróleo']) {
  if (finalLogo.includes(forbidden)) throw new Error(`Cliente Entregas: logo ainda contém identidade antiga (${forbidden})`);
}
if (!finalLogo.includes('#F6BE1C') || !finalLogo.includes('#C88A08')) {
  throw new Error('Cliente Entregas: logo dourada não foi confirmada.');
}

// __root.tsx applies only the "apois-system-theme" class to <html> for every
// product (customer, courier, merchant, admin) — "apois-customer-theme" above
// is never actually present on any element, so patching customer-theme.css
// alone never reached the real page. system-theme.css is the file that's
// actually imported and applied; it still carries the old petrol-blue
// palette this hardener was supposed to replace. Apply the same proven
// preto+dourado override used by harden-partner-entregador-theme.mjs.
const systemThemePath = resolve(root, workspace, 'src/system-theme.css');
if (!existsSync(systemThemePath)) throw new Error(`Tema global do Entregas ausente: ${systemThemePath}`);

const systemMarker = '/* APOIS_ENTREGAS_SYSTEM_GOLD_V1 */';
let systemTheme = readFileSync(systemThemePath, 'utf8');
if (!systemTheme.includes(systemMarker)) {
  systemTheme += `\n\n${systemMarker}\n/* .apois-system-theme é a classe realmente aplicada ao <html> em __root.tsx.\n * Sobrescreve a identidade petrol-blue antiga do arquivo por preto + dourado. */\n.apois-system-theme {\n  --primary: oklch(0.82 0.16 84);\n  --primary-foreground: oklch(0.11 0.006 85);\n  --accent: oklch(0.72 0.145 78);\n  --accent-foreground: oklch(0.11 0.006 85);\n  --ring: oklch(0.82 0.16 84);\n  --sidebar-primary: oklch(0.82 0.16 84);\n  --sidebar-primary-foreground: oklch(0.11 0.006 85);\n  --sidebar-ring: oklch(0.82 0.16 84);\n}\n.apois-system-theme [class*="from-primary"][class*="to-accent"],\n.apois-system-theme [class*="from-primary"][class*="via-primary"][class*="to-accent"] {\n  background-image: linear-gradient(135deg, #f6be1c, #c88a08) !important;\n  color: #070707 !important;\n}\n.apois-system-theme [class*="rgba(57,181,74"],\n.apois-system-theme [class*="rgba(106,27,154"] {\n  --tw-shadow-color: rgba(246,190,28,.26) !important;\n}\n.apois-system-theme [class~="text-[#39B54A]"],\n.apois-system-theme [class~="text-[#6A1B9A]"],\n.apois-system-theme [class~="text-[#FFD700]"],\n.apois-system-theme [class~="text-[#F6B900]"],\n.apois-system-theme [class~="text-[#FACC15]"] { color: #f6be1c !important; }\n.apois-system-theme [class~="bg-[#39B54A]"],\n.apois-system-theme [class~="bg-[#6A1B9A]"],\n.apois-system-theme [class~="bg-[#FFD700]"],\n.apois-system-theme [class~="bg-[#F6B900]"],\n.apois-system-theme [class~="bg-[#FACC15]"] { background-color: #f6be1c !important; color: #070707 !important; }\n.apois-system-theme [class~="border-[#39B54A]"],\n.apois-system-theme [class~="border-[#6A1B9A]"],\n.apois-system-theme [class~="border-[#FFD700]"],\n.apois-system-theme [class~="border-[#F6B900]"],\n.apois-system-theme [class~="border-[#FACC15]"] { border-color: #f6be1c !important; }\n.apois-system-theme input:focus,\n.apois-system-theme textarea:focus,\n.apois-system-theme select:focus { border-color: #f6be1c; }\n`;
}
writeFileSync(systemThemePath, systemTheme, 'utf8');

const finalSystemTheme = readFileSync(systemThemePath, 'utf8');
for (const required of [systemMarker, '--primary: oklch(0.82 0.16 84)', '#f6be1c']) {
  if (!finalSystemTheme.includes(required)) {
    throw new Error(`Entregas: identidade preto/dourado do tema global incompleta (${required})`);
  }
}

console.log('[OK] Cliente Entregas: telas internas, componentes, sombras e logo seguem identidade APOIS preto + dourado.');
console.log('[OK] Entregas: system-theme.css (classe realmente aplicada ao <html>) segue identidade APOIS preto + dourado.');

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
serverSource = replaceRequired(
  serverSource,
  '.brand{color:#6A1B9A;',
  '.brand{color:#f6be1c;',
  'server.ts: marca do Estabelecimento (tela de sessão expirada) usa dourado',
);
serverSource = replaceRequired(
  serverSource,
  'margin:10px auto 0;background:#39B54A}',
  'margin:10px auto 0;background:#c88a08}',
  'server.ts: sublinhado da marca (tela de sessão expirada) usa dourado',
);
writeFileSync(serverPath, serverSource, 'utf8');

const finalServerSource = readFileSync(serverPath, 'utf8');
for (const forbidden of ['#6A1B9A', '#39B54A']) {
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
loginSource = replaceRequired(
  loginSource,
  'shadow-[0_12px_35px_rgba(57,181,74,0.18)]',
  'shadow-[0_12px_35px_rgba(200,138,8,0.18)]',
  'login.tsx: brilho do botão Entrar (Estabelecimento/Admin) usa dourado',
);
writeFileSync(loginPath, loginSource, 'utf8');

const finalLoginSource = readFileSync(loginPath, 'utf8');
if (finalLoginSource.includes('rgba(57,181,74,0.18)')) {
  throw new Error('login.tsx: brilho verde do botão Entrar (Estabelecimento/Admin) ainda presente');
}

// Badge de status "Em atendimento" do painel Admin (chamados de suporte)
// era o único estado fora da paleta preto/dourado/âmbar/esmeralda já usada
// pelos demais estados (open/resolved/closed).
const adminSupportPath = resolve(root, workspace, 'src/components/AdminSupportPanel.tsx');
if (!existsSync(adminSupportPath)) throw new Error(`AdminSupportPanel.tsx do Entregas ausente: ${adminSupportPath}`);
let adminSupportSource = readFileSync(adminSupportPath, 'utf8');
adminSupportSource = replaceRequired(
  adminSupportSource,
  'in_progress: "bg-blue-500/10 text-blue-300",',
  'in_progress: "bg-primary/10 text-primary",',
  'AdminSupportPanel.tsx: badge "Em atendimento" usa identidade APOIS',
);
writeFileSync(adminSupportPath, adminSupportSource, 'utf8');

const finalAdminSupportSource = readFileSync(adminSupportPath, 'utf8');
if (finalAdminSupportSource.includes('text-blue-300') || finalAdminSupportSource.includes('bg-blue-500')) {
  throw new Error('AdminSupportPanel.tsx: badge "Em atendimento" ainda usa azul');
}

console.log('[OK] Estabelecimento: tela de sessão expirada (server.ts) segue identidade APOIS preto + dourado.');
console.log('[OK] Estabelecimento/Admin: brilho do botão Entrar em login.tsx segue identidade APOIS preto + dourado.');
console.log('[OK] Admin: badge "Em atendimento" do painel de suporte segue identidade APOIS.');
