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
  theme += `\n\n${marker}\n/* Identidade interna unificada com APOIS Corridas: preto + dourado.\n * Verde permanece reservado para sucesso/online e vermelho para erro/perigo. */\n.apois-customer-theme {\n  --background: oklch(0.105 0.006 85);\n  --foreground: oklch(0.985 0.002 85);\n  --card: oklch(0.15 0.006 85);\n  --card-foreground: oklch(0.985 0.002 85);\n  --popover: oklch(0.15 0.006 85);\n  --popover-foreground: oklch(0.985 0.002 85);\n  --primary: oklch(0.82 0.16 84);\n  --primary-foreground: oklch(0.11 0.006 85);\n  --secondary: oklch(0.19 0.008 85);\n  --secondary-foreground: oklch(0.95 0.004 85);\n  --muted: oklch(0.19 0.008 85);\n  --muted-foreground: oklch(0.68 0.012 85);\n  --accent: oklch(0.72 0.145 78);\n  --accent-foreground: oklch(0.11 0.006 85);\n  --border: oklch(0.27 0.012 85);\n  --input: oklch(0.23 0.01 85);\n  --ring: oklch(0.82 0.16 84);\n  --sidebar: oklch(0.135 0.006 85);\n  --sidebar-foreground: oklch(0.985 0.002 85);\n  --sidebar-primary: oklch(0.82 0.16 84);\n  --sidebar-primary-foreground: oklch(0.11 0.006 85);\n  --sidebar-accent: oklch(0.19 0.008 85);\n  --sidebar-accent-foreground: oklch(0.95 0.004 85);\n  --sidebar-border: oklch(0.27 0.012 85);\n  --sidebar-ring: oklch(0.82 0.16 84);\n}\n.apois-customer-theme body,\n.apois-customer-theme body > div,\n.apois-customer-theme [class~="bg-black"] { background-color:#050505; }\n.apois-customer-theme [class*="from-primary"][class*="to-accent"],\n.apois-customer-theme [class*="from-primary"][class*="via-primary"][class*="to-accent"] {\n  background-image:linear-gradient(135deg,#f7ca48,#f6be1c 56%,#c88a08) !important;\n  color:#070707 !important;\n}\n.apois-customer-theme [class~="text-[#39B54A]"],\n.apois-customer-theme [class~="text-[#6A1B9A]"],\n.apois-customer-theme [class~="text-[#1F7894]"],\n.apois-customer-theme [class~="text-[#35A9C9]"],\n.apois-customer-theme [class~="text-[#FFD700]"],\n.apois-customer-theme [class~="text-[#F6B900]"],\n.apois-customer-theme [class~="text-[#FACC15]"] { color:#f6be1c !important; }\n.apois-customer-theme [class~="bg-[#39B54A]"],\n.apois-customer-theme [class~="bg-[#6A1B9A]"],\n.apois-customer-theme [class~="bg-[#1F7894]"],\n.apois-customer-theme [class~="bg-[#35A9C9]"],\n.apois-customer-theme [class~="bg-[#FFD700]"],\n.apois-customer-theme [class~="bg-[#F6B900]"],\n.apois-customer-theme [class~="bg-[#FACC15]"] { background-color:#f6be1c !important; color:#070707 !important; }\n.apois-customer-theme [class~="border-[#39B54A]"],\n.apois-customer-theme [class~="border-[#6A1B9A]"],\n.apois-customer-theme [class~="border-[#1F7894]"],\n.apois-customer-theme [class~="border-[#35A9C9]"],\n.apois-customer-theme [class~="border-[#FFD700]"],\n.apois-customer-theme [class~="border-[#F6B900]"],\n.apois-customer-theme [class~="border-[#FACC15]"] { border-color:#f6be1c !important; }\n.apois-customer-theme input:focus,\n.apois-customer-theme textarea:focus,\n.apois-customer-theme select:focus { border-color:#f6be1c; }\n.apois-customer-theme .apois-customer-card {\n  background:linear-gradient(145deg,#151515,#0b0b0b);\n  border-color:#313131;\n  box-shadow:0 12px 34px rgba(0,0,0,.42);\n}\n.apois-customer-theme .apois-customer-soft-glow { box-shadow:0 10px 30px rgba(246,190,28,.18); }\n`;
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
for (const required of [marker, '--primary: oklch(0.82 0.16 84)', '#f6be1c', '#050505']) {
  if (!finalTheme.includes(required)) throw new Error(`Cliente Entregas: identidade preto/dourado incompleta (${required})`);
}
for (const forbidden of ['#1F7894', '#35A9C9', 'azul petróleo']) {
  if (finalLogo.includes(forbidden)) throw new Error(`Cliente Entregas: logo ainda contém identidade antiga (${forbidden})`);
}
if (!finalLogo.includes('#F6BE1C') || !finalLogo.includes('#C88A08')) {
  throw new Error('Cliente Entregas: logo dourada não foi confirmada.');
}

console.log('[OK] Cliente Entregas: telas internas, componentes e logo seguem identidade APOIS preto + dourado.');
