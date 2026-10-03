import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const themePath = resolve(root, workspace, 'src/customer-theme.css');
const logoPath = resolve(root, workspace, 'public/apois-logo-customer.svg');

if (!existsSync(themePath)) throw new Error(`Tema do Cliente Entregas ausente: ${themePath}`);
if (!existsSync(logoPath)) throw new Error(`Logo do Cliente Entregas ausente: ${logoPath}`);

const marker = '/* APOIS_CUSTOMER_UNIFIED_LIGHT_V1 */';
let customerTheme = readFileSync(themePath, 'utf8');
if (!customerTheme.includes(marker)) {
  customerTheme += `

${marker}
/* Migração exclusivamente visual: branco/cinza predominante, preto estrutural,
 * vermelho APOIS como ação. Estados semânticos (success/warning/info/error)
 * continuam usando seus próprios tokens. */
.apois-customer-theme {
  --background: #F7F7F8;
  --foreground: #111111;
  --card: #FFFFFF;
  --card-foreground: #111111;
  --popover: #FFFFFF;
  --popover-foreground: #111111;
  --primary: #E51B23;
  --primary-foreground: #FFFFFF;
  --secondary: #FFFFFF;
  --secondary-foreground: #111111;
  --muted: #F1F2F4;
  --muted-foreground: #9CA1A9;
  --accent: #FFF1F2;
  --accent-foreground: #E51B23;
  --border: #E2E4E8;
  --input: #FFFFFF;
  --ring: #E51B23;
  --sidebar: #FFFFFF;
  --sidebar-foreground: #111111;
  --sidebar-primary: #E51B23;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #FFF1F2;
  --sidebar-accent-foreground: #E51B23;
  --sidebar-border: #E2E4E8;
  --sidebar-ring: #E51B23;
  color-scheme: light;
}
.apois-customer-theme body,
.apois-customer-theme body > div { background-color:#F7F7F8; color:#111111; }
.apois-customer-theme [class*="from-primary"][class*="to-accent"],
.apois-customer-theme [class*="from-primary"][class*="via-primary"][class*="to-accent"] {
  background-image:none !important;
  background-color:#E51B23 !important;
  color:#FFFFFF !important;
}
.apois-customer-theme [class~="text-[#6A1B9A]"],
.apois-customer-theme [class~="text-[#1F7894]"],
.apois-customer-theme [class~="text-[#35A9C9]"],
.apois-customer-theme [class~="text-[#FFD700]"],
.apois-customer-theme [class~="text-[#F6B900]"],
.apois-customer-theme [class~="text-[#FACC15]"],
.apois-customer-theme [class~="text-[#F6BE1C]"] { color:#E51B23 !important; }
.apois-customer-theme [class~="bg-[#6A1B9A]"],
.apois-customer-theme [class~="bg-[#1F7894]"],
.apois-customer-theme [class~="bg-[#35A9C9]"],
.apois-customer-theme [class~="bg-[#FFD700]"],
.apois-customer-theme [class~="bg-[#F6B900]"],
.apois-customer-theme [class~="bg-[#FACC15]"],
.apois-customer-theme [class~="bg-[#F6BE1C]"] { background-color:#E51B23 !important; color:#FFFFFF !important; }
.apois-customer-theme [class~="border-[#6A1B9A]"],
.apois-customer-theme [class~="border-[#1F7894]"],
.apois-customer-theme [class~="border-[#35A9C9]"],
.apois-customer-theme [class~="border-[#FFD700]"],
.apois-customer-theme [class~="border-[#F6B900]"],
.apois-customer-theme [class~="border-[#FACC15]"],
.apois-customer-theme [class~="border-[#F6BE1C]"] { border-color:#E51B23 !important; }
.apois-customer-theme input,
.apois-customer-theme textarea,
.apois-customer-theme select {
  background:#FFFFFF;
  color:#111111;
  border-color:#E2E4E8;
}
.apois-customer-theme input::placeholder,
.apois-customer-theme textarea::placeholder { color:#9CA1A9; }
.apois-customer-theme input:focus,
.apois-customer-theme textarea:focus,
.apois-customer-theme select:focus {
  border-color:#E51B23;
  box-shadow:0 0 0 3px rgba(229,27,35,.10);
}
.apois-customer-theme .apois-customer-card {
  background:#FFFFFF;
  border-color:#E2E4E8;
  box-shadow:0 10px 28px rgba(17,17,17,.07);
}
.apois-customer-theme .apois-customer-soft-glow { box-shadow:0 10px 28px rgba(17,17,17,.06); }
`;
}
writeFileSync(themePath, customerTheme, 'utf8');

// O wrapper oficial final é aplicado por apply-apois-brand-v2.mjs.
// Aqui removemos apenas a paleta de marca antiga do SVG fonte, sem alterar geometria.
let logo = readFileSync(logoPath, 'utf8')
  .replaceAll('#1F7894', '#111111')
  .replaceAll('#35A9C9', '#E51B23')
  .replaceAll('#39B54A', '#E51B23')
  .replaceAll('#6A1B9A', '#111111')
  .replaceAll('#F6BE1C', '#E51B23')
  .replaceAll('#C88A08', '#C9141B')
  .replaceAll('azul petróleo', 'vermelho e preto')
  .replaceAll('dourado', 'vermelho e preto');
writeFileSync(logoPath, logo, 'utf8');

const systemThemePath = resolve(root, workspace, 'src/system-theme.css');
if (!existsSync(systemThemePath)) throw new Error(`Tema global do Entregas ausente: ${systemThemePath}`);

const systemMarker = '/* APOIS_ENTREGAS_SYSTEM_UNIFIED_LIGHT_V1 */';
let systemTheme = readFileSync(systemThemePath, 'utf8');
if (!systemTheme.includes(systemMarker)) {
  systemTheme += `

${systemMarker}
/* .apois-system-theme é a classe realmente aplicada ao <html>. */
.apois-system-theme {
  --background:#F7F7F8;
  --foreground:#111111;
  --card:#FFFFFF;
  --card-foreground:#111111;
  --popover:#FFFFFF;
  --popover-foreground:#111111;
  --primary:#E51B23;
  --primary-foreground:#FFFFFF;
  --secondary:#FFFFFF;
  --secondary-foreground:#111111;
  --muted:#F1F2F4;
  --muted-foreground:#9CA1A9;
  --accent:#FFF1F2;
  --accent-foreground:#E51B23;
  --border:#E2E4E8;
  --input:#FFFFFF;
  --ring:#E51B23;
  --sidebar:#FFFFFF;
  --sidebar-foreground:#111111;
  --sidebar-primary:#E51B23;
  --sidebar-primary-foreground:#FFFFFF;
  --sidebar-accent:#FFF1F2;
  --sidebar-accent-foreground:#E51B23;
  --sidebar-border:#E2E4E8;
  --sidebar-ring:#E51B23;
  color-scheme:light;
}
.apois-system-theme body,
.apois-system-theme body > div { background:#F7F7F8; color:#111111; }
.apois-system-theme [class*="from-primary"][class*="to-accent"],
.apois-system-theme [class*="from-primary"][class*="via-primary"][class*="to-accent"] {
  background-image:none !important;
  background-color:#E51B23 !important;
  color:#FFFFFF !important;
}
.apois-system-theme [class~="text-[#6A1B9A]"],
.apois-system-theme [class~="text-[#1F7894]"],
.apois-system-theme [class~="text-[#35A9C9]"],
.apois-system-theme [class~="text-[#FFD700]"],
.apois-system-theme [class~="text-[#F6B900]"],
.apois-system-theme [class~="text-[#FACC15]"],
.apois-system-theme [class~="text-[#F6BE1C]"] { color:#E51B23 !important; }
.apois-system-theme [class~="bg-[#6A1B9A]"],
.apois-system-theme [class~="bg-[#1F7894]"],
.apois-system-theme [class~="bg-[#35A9C9]"],
.apois-system-theme [class~="bg-[#FFD700]"],
.apois-system-theme [class~="bg-[#F6B900]"],
.apois-system-theme [class~="bg-[#FACC15]"],
.apois-system-theme [class~="bg-[#F6BE1C]"] { background:#E51B23 !important; color:#FFFFFF !important; }
.apois-system-theme input,
.apois-system-theme textarea,
.apois-system-theme select { background:#FFFFFF; color:#111111; border-color:#E2E4E8; }
.apois-system-theme input:focus,
.apois-system-theme textarea:focus,
.apois-system-theme select:focus { border-color:#E51B23; box-shadow:0 0 0 3px rgba(229,27,35,.10); }
`;
}
writeFileSync(systemThemePath, systemTheme, 'utf8');

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) return source;
  console.log(`[OK] ${label}`);
  return source.replaceAll(search, replacement);
}

// HTML bruto da sessão expirada: somente aparência.
const serverPath = resolve(root, workspace, 'src/server.ts');
if (existsSync(serverPath)) {
  let serverSource = readFileSync(serverPath, 'utf8');
  serverSource = replaceRequired(serverSource, '.brand{color:#6A1B9A;', '.brand{color:#E51B23;', 'server.ts: marca antiga -> vermelho APOIS');
  serverSource = replaceRequired(serverSource, 'margin:10px auto 0;background:#39B54A}', 'margin:10px auto 0;background:#C9141B}', 'server.ts: sublinhado antigo -> vermelho hover');
  serverSource = replaceRequired(serverSource, 'background:#050505;', 'background:#F7F7F8;', 'server.ts: fundo antigo -> fundo claro');
  serverSource = replaceRequired(serverSource, 'color:#fff;', 'color:#111;', 'server.ts: texto antigo -> preto');
  writeFileSync(serverPath, serverSource, 'utf8');
}

// Login Estabelecimento/Admin: troca somente o brilho visual literal do botão.
const loginPath = resolve(root, workspace, 'src/routes/login.tsx');
if (existsSync(loginPath)) {
  let loginSource = readFileSync(loginPath, 'utf8');
  loginSource = loginSource
    .replaceAll('shadow-[0_12px_35px_rgba(57,181,74,0.18)]', 'shadow-[0_12px_30px_rgba(229,27,35,0.16)]')
    .replaceAll('shadow-[0_12px_35px_rgba(246,190,28,0.18)]', 'shadow-[0_12px_30px_rgba(229,27,35,0.16)]');
  writeFileSync(loginPath, loginSource, 'utf8');
}

// Status operacionais (green/amber/blue/red) NÃO são convertidos aqui.
for (const [path, required] of [
  [themePath, [marker, '--primary: #E51B23', '--background: #F7F7F8', 'color-scheme: light']],
  [systemThemePath, [systemMarker, '--primary:#E51B23', '--background:#F7F7F8', 'color-scheme:light']],
]) {
  const source = readFileSync(path, 'utf8');
  for (const token of required) {
    if (!source.includes(token)) throw new Error(`Entregas: identidade unificada incompleta em ${path} (${token})`);
  }
}

console.log('[OK] Entregas/Estabelecimento/Admin: identidade visual clara vermelho+preto+branco aplicada sem alterar regras, estados semânticos ou fluxos.');
