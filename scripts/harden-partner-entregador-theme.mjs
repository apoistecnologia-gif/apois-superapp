import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/system-theme.css');
let source = readFileSync(path, 'utf8');

const legacyGoldMarker = '/* APOIS_ENTREGAS_SYSTEM_GOLD_V1 */';
if (source.includes(legacyGoldMarker)) {
  source = source.slice(0, source.indexOf(legacyGoldMarker)).trimEnd() + '\n';
  console.log('[OK] Entregador Parceiro: override preto/dourado legado removido da cópia descartável.');
}

const marker = '/* APOIS_PARTNER_COURIER_RED_V2 */';
if (!source.includes(marker)) {
  source += `

${marker}
/* APOIS Parceiro — identidade clara vermelho/branco.
 * Verde, âmbar e vermelho semântico continuam reservados a estados operacionais. */
.apois-system-theme {
  --background: oklch(0.97 0.003 20);
  --foreground: oklch(0.16 0.008 20);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.16 0.008 20);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.16 0.008 20);
  --primary: oklch(0.59 0.24 27);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.94 0.008 20);
  --secondary-foreground: oklch(0.18 0.008 20);
  --muted: oklch(0.94 0.008 20);
  --muted-foreground: oklch(0.48 0.012 20);
  --accent: oklch(0.52 0.22 27);
  --accent-foreground: oklch(1 0 0);
  --border: oklch(0.90 0.008 20);
  --input: oklch(0.92 0.008 20);
  --ring: oklch(0.59 0.24 27);
  --sidebar: oklch(1 0 0);
  --sidebar-foreground: oklch(0.16 0.008 20);
  --sidebar-primary: oklch(0.59 0.24 27);
  --sidebar-primary-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.97 0.01 20);
  --sidebar-accent-foreground: oklch(0.18 0.008 20);
  --sidebar-border: oklch(0.90 0.008 20);
  --sidebar-ring: oklch(0.59 0.24 27);
}
.apois-system-theme body,
.apois-system-theme body > div,
.apois-system-theme [class~="bg-black"] {
  background-color:#F7F7F8 !important;
  color:#111111;
}
.apois-system-theme [class~="bg-zinc-950"],
.apois-system-theme [class~="bg-zinc-900"] { background-color:#FFFFFF !important; }
.apois-system-theme [class~="text-white"] { color:#111111 !important; }
.apois-system-theme [class~="text-zinc-300"] { color:#33383F !important; }
.apois-system-theme [class~="text-zinc-400"] { color:#555B63 !important; }
.apois-system-theme [class~="text-zinc-500"] { color:#666B73 !important; }
.apois-system-theme [class~="text-zinc-600"] { color:#777D85 !important; }
.apois-system-theme [class*="border-zinc-8"] { border-color:#E2E4E8 !important; }
.apois-system-theme [class*="from-primary"][class*="to-accent"],
.apois-system-theme [class*="from-primary"][class*="via-primary"][class*="to-accent"] {
  background-image:linear-gradient(135deg,#FF5A60,#E51B23 56%,#C9141B) !important;
  color:#FFFFFF !important;
}
.apois-system-theme [class~="text-[#39B54A]"],
.apois-system-theme [class~="text-[#6A1B9A]"],
.apois-system-theme [class~="text-[#FFD700]"],
.apois-system-theme [class~="text-[#F6B900]"],
.apois-system-theme [class~="text-[#FACC15]"] { color:#E51B23 !important; }
.apois-system-theme [class~="bg-[#39B54A]"],
.apois-system-theme [class~="bg-[#6A1B9A]"],
.apois-system-theme [class~="bg-[#FFD700]"],
.apois-system-theme [class~="bg-[#F6B900]"],
.apois-system-theme [class~="bg-[#FACC15]"] { background-color:#E51B23 !important; color:#FFFFFF !important; }
.apois-system-theme input:focus,
.apois-system-theme textarea:focus,
.apois-system-theme select:focus { border-color:#E51B23; }
`;
}

for (const required of [marker, '--primary: oklch(0.59 0.24 27)', '#E51B23', '#C9141B', '#F7F7F8']) {
  if (!source.includes(required)) throw new Error(`Entregador Parceiro: tema vermelho/branco incompleto (${required}).`);
}
for (const forbidden of ['APOIS_PARTNER_COURIER_GOLD_V1', '#f6be1c', '#c88a08']) {
  if (source.includes(forbidden)) throw new Error(`Entregador Parceiro: identidade antiga permaneceu no tema (${forbidden}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: identidade visual vermelho/branco aplicada sem alterar estados operacionais.');
