import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/system-theme.css');
let source = readFileSync(path, 'utf8');

const marker = '/* APOIS_PARTNER_COURIER_GOLD_V1 */';
if (!source.includes(marker)) {
  source += `

${marker}
/* O APOIS Parceiro segue a identidade oficial preto + dourado. Estados de
 * sucesso/erro continuam usando verde/vermelho sem transformar a marca em azul. */
.apois-system-theme {
  --background: oklch(0.105 0.006 85);
  --foreground: oklch(0.985 0.002 85);
  --card: oklch(0.15 0.006 85);
  --card-foreground: oklch(0.985 0.002 85);
  --popover: oklch(0.15 0.006 85);
  --popover-foreground: oklch(0.985 0.002 85);
  --primary: oklch(0.82 0.16 84);
  --primary-foreground: oklch(0.11 0.006 85);
  --secondary: oklch(0.19 0.008 85);
  --secondary-foreground: oklch(0.95 0.004 85);
  --muted: oklch(0.19 0.008 85);
  --muted-foreground: oklch(0.68 0.012 85);
  --accent: oklch(0.72 0.145 78);
  --accent-foreground: oklch(0.11 0.006 85);
  --border: oklch(0.27 0.012 85);
  --input: oklch(0.23 0.01 85);
  --ring: oklch(0.82 0.16 84);
  --sidebar: oklch(0.135 0.006 85);
  --sidebar-foreground: oklch(0.985 0.002 85);
  --sidebar-primary: oklch(0.82 0.16 84);
  --sidebar-primary-foreground: oklch(0.11 0.006 85);
  --sidebar-accent: oklch(0.19 0.008 85);
  --sidebar-accent-foreground: oklch(0.95 0.004 85);
  --sidebar-border: oklch(0.27 0.012 85);
  --sidebar-ring: oklch(0.82 0.16 84);
}
.apois-system-theme body,
.apois-system-theme body > div,
.apois-system-theme [class~="bg-black"] { background-color: #050505; }
.apois-system-theme [class*="from-primary"][class*="to-accent"],
.apois-system-theme [class*="from-primary"][class*="via-primary"][class*="to-accent"] {
  background-image: linear-gradient(135deg, #f6be1c, #c88a08) !important;
  color: #070707 !important;
}
.apois-system-theme [class~="text-[#39B54A]"],
.apois-system-theme [class~="text-[#6A1B9A]"],
.apois-system-theme [class~="text-[#FFD700]"],
.apois-system-theme [class~="text-[#F6B900]"],
.apois-system-theme [class~="text-[#FACC15]"] { color: #f6be1c !important; }
.apois-system-theme [class~="bg-[#39B54A]"],
.apois-system-theme [class~="bg-[#6A1B9A]"],
.apois-system-theme [class~="bg-[#FFD700]"],
.apois-system-theme [class~="bg-[#F6B900]"],
.apois-system-theme [class~="bg-[#FACC15]"] { background-color: #f6be1c !important; color:#070707 !important; }
.apois-system-theme input:focus,
.apois-system-theme textarea:focus,
.apois-system-theme select:focus { border-color: #f6be1c; }
`;
}

if (!source.includes(marker) || !source.includes('--primary: oklch(0.82 0.16 84)') || !source.includes('#f6be1c')) {
  throw new Error('Entregador Parceiro: tema preto/dourado não foi aplicado.');
}
writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: identidade petrol-blue antiga sobreposta pelo padrão oficial preto + dourado.');
