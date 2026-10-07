import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = process.cwd();
const MOTORISTA = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const ENTREGADOR = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';

const MOTORISTA_MARKER = '/* APOIS_PARTNER_RED_VISUAL_V1 */';
const ENTREGADOR_MARKER = '/* APOIS_PARTNER_COURIER_RED_VISUAL_V1 */';

function walk(dir, visit) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', '.output', 'android'].includes(entry.name)) continue;
    const target = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(target, visit);
    else visit(target);
  }
}

function replaceVisualTokens(source) {
  return source
    .replaceAll('#F6BE1C', '#E51B23')
    .replaceAll('#f6be1c', '#E51B23')
    .replaceAll('#F7CA48', '#FF5A60')
    .replaceAll('#f7ca48', '#FF5A60')
    .replaceAll('#C88A08', '#C9141B')
    .replaceAll('#c88a08', '#C9141B')
    .replaceAll('rgba(246,190,28', 'rgba(229,27,35')
    .replaceAll('rgba(200,138,8', 'rgba(201,20,27')
    .replaceAll('text-[#F6BE1C]', 'text-[#E51B23]')
    .replaceAll('text-[#C88A08]', 'text-[#C9141B]')
    .replaceAll('border-[#F6BE1C]', 'border-[#E51B23]')
    .replaceAll('border-[#C88A08]', 'border-[#C9141B]')
    .replaceAll('bg-[#F6BE1C]', 'bg-[#E51B23]')
    .replaceAll('bg-[#C88A08]', 'bg-[#C9141B]');
}

function hardenMotorista() {
  const src = resolve(root, MOTORISTA, 'src');
  walk(src, (path) => {
    if (!['.ts', '.tsx', '.css'].includes(extname(path))) return;
    const before = readFileSync(path, 'utf8');
    let after = replaceVisualTokens(before);

    if (path.endsWith('.tsx')) {
      after = after
        .replaceAll('bg-[#050607]', 'bg-[#F7F7F8]')
        .replaceAll('bg-[#050505]', 'bg-[#F7F7F8]')
        .replaceAll('bg-[#08090A]', 'bg-white')
        .replaceAll('bg-[#0D0F11]', 'bg-white')
        .replaceAll('bg-[#101214]', 'bg-white')
        .replaceAll('bg-[#111315]', 'bg-[#F1F2F4]')
        .replaceAll('bg-[#121518]', 'bg-white')
        .replaceAll('bg-black/20', 'bg-[#F7F7F8]')
        .replaceAll('bg-black/30', 'bg-[#F7F7F8]')
        .replaceAll('bg-black/40', 'bg-[#F7F7F8]')
        .replaceAll('bg-black', 'bg-[#F7F7F8]')
        .replaceAll('border-white/5', 'border-[#E2E4E8]')
        .replaceAll('border-white/6', 'border-[#E2E4E8]')
        .replaceAll('border-white/8', 'border-[#E2E4E8]')
        .replaceAll('border-white/10', 'border-[#E2E4E8]')
        .replaceAll('text-zinc-300', 'text-[#33383F]')
        .replaceAll('text-zinc-400', 'text-[#555B63]')
        .replaceAll('text-zinc-500', 'text-[#666B73]')
        .replaceAll('text-zinc-600', 'text-[#777D85]')
        .replaceAll('text-zinc-700', 'text-[#8A9098]')
        .replaceAll('text-white', 'text-[#111111]')
        .replaceAll('bg-[#E51B23] text-[#111111]', 'bg-[#E51B23] text-white')
        .replaceAll('bg-[#C9141B] text-[#111111]', 'bg-[#C9141B] text-white')
        .replaceAll('bg-gradient-to-br from-[#241C08] via-[#111315] to-[#08090A]', 'bg-[linear-gradient(145deg,#FFFFFF,#FFF8F8_58%,#FFF1F2)]')
        .replaceAll('ring-white/5', 'ring-[#E2E4E8]')
        .replaceAll('ring-white/10', 'ring-[#E2E4E8]');
    }

    if (after !== before) writeFileSync(path, after, 'utf8');
  });

  const stylePath = resolve(root, MOTORISTA, 'src/styles.css');
  if (existsSync(stylePath)) {
    let style = readFileSync(stylePath, 'utf8');
    if (!style.includes(MOTORISTA_MARKER)) {
      style += `\n\n${MOTORISTA_MARKER}
:root,.light,.dark {
  --background: 0 0% 97%;
  --foreground: 220 9% 7%;
  --surface: 0 0% 100%;
  --surface-2: 350 100% 98%;
  --card: 0 0% 100%;
  --card-foreground: 220 9% 7%;
  --popover: 0 0% 100%;
  --popover-foreground: 220 9% 7%;
  --primary: 358 79% 50%;
  --primary-foreground: 0 0% 100%;
  --primary-glow: 358 100% 67%;
  --secondary: 220 14% 96%;
  --secondary-foreground: 220 9% 12%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 7% 43%;
  --accent: 358 82% 43%;
  --accent-foreground: 0 0% 100%;
  --border: 220 10% 90%;
  --input: 220 10% 90%;
  --ring: 358 79% 50%;
  --sidebar: 0 0% 100%;
  --sidebar-foreground: 220 9% 7%;
  --sidebar-primary: 358 79% 50%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 350 100% 98%;
  --sidebar-accent-foreground: 220 9% 12%;
  --sidebar-border: 220 10% 90%;
  --sidebar-ring: 358 79% 50%;
  color-scheme: light;
}
body { background:#F7F7F8 !important; color:#111111 !important; }
`;
      writeFileSync(stylePath, style, 'utf8');
    }
  }

  const must = [
    resolve(root, MOTORISTA, 'src/routes/motorista.login.tsx'),
    resolve(root, MOTORISTA, 'src/routes/motorista.app.tsx'),
    resolve(root, MOTORISTA, 'src/routes/motorista.perfil.tsx'),
  ];
  for (const path of must) {
    const source = readFileSync(path, 'utf8');
    if (!source.includes('#E51B23') && !source.includes('text-primary') && !source.includes('bg-primary')) throw new Error('[FAIL] Parceiro visual: superfície sem identidade vermelha em ' + path);
    if (source.includes('#F6BE1C') || source.includes('#C88A08')) {
      throw new Error('[FAIL] Parceiro visual: dourado antigo permaneceu em ' + path);
    }
  }
  console.log('[OK] Motorista Parceiro migrado visualmente para APOIS vermelho/branco/preto sem alterar lógica.');
}

function hardenEntregador() {
  const themePath = resolve(root, ENTREGADOR, 'src/system-theme.css');
  if (!existsSync(themePath)) throw new Error('[FAIL] Parceiro visual: system-theme.css do Entregador ausente');
  let source = readFileSync(themePath, 'utf8');
  source = replaceVisualTokens(source);
  if (!source.includes(ENTREGADOR_MARKER)) {
    source += `\n\n${ENTREGADOR_MARKER}
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
  --border: oklch(0.9 0.008 20);
  --input: oklch(0.92 0.008 20);
  --ring: oklch(0.59 0.24 27);
}
.apois-system-theme body,
.apois-system-theme body > div,
.apois-system-theme [class~="bg-black"] { background-color:#F7F7F8 !important; color:#111111; }
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
.apois-system-theme button[class*="bg-primary"],
.apois-system-theme [class~="bg-primary"] { color:#FFFFFF !important; }
`;
  }
  writeFileSync(themePath, source, 'utf8');

  const src = resolve(root, ENTREGADOR, 'src');
  walk(src, (path) => {
    if (!['.ts', '.tsx', '.css'].includes(extname(path))) return;
    const before = readFileSync(path, 'utf8');
    const after = replaceVisualTokens(before);
    if (after !== before) writeFileSync(path, after, 'utf8');
  });

  const final = readFileSync(themePath, 'utf8');
  if (!final.includes(ENTREGADOR_MARKER) || !final.includes('#E51B23')) {
    throw new Error('[FAIL] Parceiro visual: tema vermelho/branco do Entregador não foi confirmado');
  }
  console.log('[OK] Entregador Parceiro migrado visualmente para APOIS vermelho/branco/preto sem alterar lógica.');
}

if (process.env.APOIS_MOTORISTA_WORKSPACE) hardenMotorista();
if (process.env.APOIS_ENTREGAS_WORKSPACE) hardenEntregador();
