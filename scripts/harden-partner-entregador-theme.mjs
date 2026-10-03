import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/system-theme.css');
let source = readFileSync(path, 'utf8');

const marker = '/* APOIS_PARTNER_COURIER_UNIFIED_LIGHT_V1 */';
if (!source.includes(marker)) {
  source += `

${marker}
/* Migração somente visual. O Entregador usa a mesma identidade APOIS do
 * Motorista/Passageiro. Verde, amarelo, azul e vermelho semânticos continuam
 * disponíveis para status operacionais. */
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
.apois-system-theme input::placeholder,
.apois-system-theme textarea::placeholder { color:#9CA1A9; }
.apois-system-theme input:focus,
.apois-system-theme textarea:focus,
.apois-system-theme select:focus { border-color:#E51B23; box-shadow:0 0 0 3px rgba(229,27,35,.10); }
`;
}

if (!source.includes(marker) || !source.includes('--primary:#E51B23') || !source.includes('--background:#F7F7F8')) {
  throw new Error('Entregador Parceiro: identidade visual unificada não foi aplicada.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: identidade antiga foi sobreposta pelo padrão APOIS claro vermelho+preto+branco, preservando estados semânticos.');
