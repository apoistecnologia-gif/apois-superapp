import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = process.cwd();
const target = process.argv[2];
if (!target) throw new Error('Uso: node scripts/apply-apois-brand-v2.mjs <corridas|entregas|motorista|entregador|admin|shell-client|shell-partner> [path]');

const tokens = JSON.parse(readFileSync(resolve(root, 'design-system/apois-brand-v2.json'), 'utf8'));
const p = tokens.palette;
const s = tokens.semantic;
const MARKER_BEGIN = '/* APOIS_BRAND_V2_BEGIN */';
const MARKER_END = '/* APOIS_BRAND_V2_END */';
const LEGACY_MARKER_BEGIN = '/* APOIS_BRAND_V2 */ BEGIN';
const LEGACY_MARKER_END = '/* APOIS_BRAND_V2 */ END';

function replaceBlock(path, block) {
  if (!existsSync(path)) throw new Error(`Arquivo visual ausente: ${path}`);
  let before = readFileSync(path, 'utf8');

  // Migra qualquer saída antiga inválida para marcadores CSS válidos.
  // O formato "/* APOIS_BRAND_V2 */ BEGIN" deixava BEGIN/END como tokens
  // CSS crus e o LightningCSS encerrava o build com "Unexpected end of input".
  before = before
    .replaceAll(LEGACY_MARKER_BEGIN, MARKER_BEGIN)
    .replaceAll(LEGACY_MARKER_END, MARKER_END);

  const wrapped = `${MARKER_BEGIN}\n${block.trim()}\n${MARKER_END}`;
  let after;
  const start = before.indexOf(MARKER_BEGIN);
  const finish = before.indexOf(MARKER_END);
  if (start >= 0 && finish > start) {
    after = before.slice(0, start) + wrapped + before.slice(finish + MARKER_END.length);
  } else {
    after = `${before.trimEnd()}\n\n${wrapped}\n`;
  }
  if (after !== before) writeFileSync(path, after, 'utf8');
}

function patchText(path, transform) {
  if (!existsSync(path)) return;
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after !== before) writeFileSync(path, after, 'utf8');
}

function walkText(dir, fn) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const path = resolve(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (!['node_modules','.git','dist','.output','.tanstack'].includes(name)) walkText(path, fn);
      continue;
    }
    if (!['.ts','.tsx','.css','.html','.js','.jsx','.mjs'].includes(extname(name))) continue;
    patchText(path, fn);
  }
}

const BRAND_SOURCE = resolve(root, 'superapp/branding/apois-wordmark-v3.svg');

function requireBrandSource() {
  if (!existsSync(BRAND_SOURCE)) throw new Error(`Logo oficial APOIS Brand V2 ausente: ${BRAND_SOURCE}`);
  return readFileSync(BRAND_SOURCE);
}

function brandDataUrl() {
  return `data:image/svg+xml;base64,${requireBrandSource().toString('base64')}`;
}

function syncPublicRasterBrand(ws) {
  const publicDir = resolve(ws, 'public');
  if (!existsSync(publicDir)) return;
  // A arte oficial atual é JPEG. Não grave bytes JPEG em arquivos .png:
  // mantenha os ícones legados até o pipeline Android convertê-los corretamente.
  writeFileSync(resolve(publicDir, 'apois-wordmark-v3.svg'), requireBrandSource());
}

function syncSvgBrandWrapper(ws) {
  const publicDir = resolve(ws, 'public');
  if (!existsSync(publicDir)) return;
  const dataUrl = brandDataUrl();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="APOIS"><image href="${dataUrl}" width="512" height="512" preserveAspectRatio="xMidYMid meet"/></svg>\n`;
  for (const name of ['apois-logo.svg', 'apois-logo-customer.svg']) {
    if (existsSync(resolve(publicDir, name))) writeFileSync(resolve(publicDir, name), svg, 'utf8');
  }
}

function syncEmbeddedBrandModule(ws) {
  const logoModule = resolve(ws, 'src/assets/apoisLogoData.ts');
  if (!existsSync(logoModule)) return;
  writeFileSync(
    logoModule,
    `// APOIS_BRAND_V2_LOGO — arte oficial fornecida pelo projeto.\nexport const APOIS_LOGO_DATA_URL = "${brandDataUrl()}";\n`,
    'utf8',
  );
}

const vars = `
  --apois-black: ${p.black};
  --apois-black-secondary: ${p.blackSecondary};
  --apois-black-elevated: ${p.blackElevated};
  --apois-red: ${p.red};
  --apois-red-strong: ${p.redStrong};
  --apois-red-dark: ${p.redDark};
  --apois-white: ${p.white};
  --apois-white-secondary: ${p.whiteSecondary};
  --apois-text-muted: ${p.textMuted};
  --apois-gold: ${p.gold};
  --apois-gold-light: ${p.goldLight};
  --apois-gold-dark: ${p.goldDark};
  --background: ${s.background};
  --foreground: ${s.textPrimary};
  --surface: ${s.surface};
  --surface-2: ${s.surfaceElevated};
  --surface-elevated: ${s.surfaceElevated};
  --card: ${s.surface};
  --card-foreground: ${s.textPrimary};
  --popover: ${s.surface};
  --popover-foreground: ${s.textPrimary};
  --primary-brand: ${s.primaryBrand};
  --primary: ${s.primary};
  --primary-hover: ${s.primaryHover};
  --primary-strong: ${s.primaryStrong};
  --primary-dark: ${s.primaryDark};
  --primary-foreground: ${s.primaryForeground};
  --secondary: ${s.secondary};
  --secondary-foreground: ${s.secondaryForeground};
  --accent: ${s.accent};
  --accent-foreground: ${s.accentForeground};
  --text-primary: ${s.textPrimary};
  --text-secondary: ${s.textSecondary};
  --muted: ${s.surfaceElevated};
  --muted-foreground: ${s.textMuted};
  --border: ${s.border};
  --input: ${s.input};
  --ring: ${s.ring};
  --destructive: ${s.destructive};
  --destructive-foreground: ${s.destructiveForeground};
  --success: ${s.success};
  --warning: ${s.warning};
  --info: ${s.info};
  --sidebar: ${s.surface};
  --sidebar-foreground: ${s.textPrimary};
  --sidebar-primary: ${s.primary};
  --sidebar-primary-foreground: ${s.primaryForeground};
  --sidebar-accent: ${s.surfaceElevated};
  --sidebar-accent-foreground: ${s.textPrimary};
  --sidebar-border: ${s.border};
  --sidebar-ring: ${s.ring};
`;

const compatibility = `
input:focus, textarea:focus, select:focus { border-color: var(--primary-brand); }
::selection { background: color-mix(in srgb, var(--primary-brand) 30%, transparent); color: var(--text-primary); }
`;

function legacyUtilityOverrides(scope) {
  const q = scope ? `${scope} ` : '';
  const old = ['#39B54A','#6A1B9A','#1F7894','#35A9C9','#FFD700','#F6B900','#FACC15','#F6BE1C'];
  const text = old.map(c => `${q}[class~="text-[${c}]"]`).join(',\n');
  const bg = old.map(c => `${q}[class~="bg-[${c}]"]`).join(',\n');
  const border = old.map(c => `${q}[class~="border-[${c}]"]`).join(',\n');
  return `
${text} { color: var(--primary-brand) !important; }
${bg} { background: var(--primary) !important; color: var(--primary-foreground) !important; }
${border} { border-color: var(--primary-brand) !important; }
`;
}

function appCss(scope=':root, .dark') {
  return `
${scope} {
${vars}
  color-scheme: dark;
}
body { background: var(--background); color: var(--foreground); }
${compatibility}
`;
}

function passenger() {
  const ws = resolve(root, '.work/corridas');
  syncPublicRasterBrand(ws);
  patchText(resolve(ws, 'src/routes/_public.login.tsx'), (text) => text
    .replace('import logo from "@/assets/logo.jpg";', `const logo = "${brandDataUrl()}";`)
  );
  const styles = resolve(ws, 'src/styles.css');
  replaceBlock(styles, `
@theme {
  --color-primary: ${s.primary};
  --color-secondary: ${s.accent};
  --color-surface: ${s.surface};
  --color-apois-primary: ${s.primary};
  --color-apois-primary-hover: ${s.primaryHover};
  --color-apois-red: ${s.primaryBrand};
  --color-apois-gold: ${s.accent};
  --color-apois-gold-light: ${p.goldLight};
  --color-apois-yellow: ${s.primary};
}
:root {
${vars}
}
body { background-color: var(--background); color: var(--foreground); }
input, textarea, select { background-color: var(--input); color: var(--text-primary); }
input::placeholder, textarea::placeholder { color: var(--muted-foreground); }
input:focus, textarea:focus, select:focus { border-color: var(--primary-brand); }
${legacyUtilityOverrides('')}
`);

  walkText(resolve(ws, 'src'), (text) => text
    .replaceAll('apois-yellow', 'apois-primary')
    .replaceAll('#ffb800', p.red)
    .replaceAll('#FFB800', p.red)
    .replaceAll('#ff5c00', p.gold)
    .replaceAll('#FF5C00', p.gold)
    .replaceAll('rgba(255,184,0', 'rgba(245,34,45')
    .replaceAll('rgba(255, 184, 0', 'rgba(245, 34, 45')
  );

  // CTA/auth antigos usavam Tailwind yellow genérico como cor de marca.
  for (const file of [
    'src/routes/_public.login.tsx',
    'src/routes/_public.cadastro.tsx',
    'src/routes/_public.recuperar-senha.tsx',
    'src/routes/_public.redefinir-senha.tsx',
    'src/routes/_authenticated.buscar-destino.tsx',
    'src/routes/_authenticated.perfil.tsx',
    'src/components/route/RouteSummary.tsx',
    'src/components/rides/RideStopsInput.tsx'
  ]) {
    patchText(resolve(ws, file), (text) => text
      .replaceAll('yellow-500', 'apois-primary')
      .replaceAll('yellow-600', 'apois-primary-hover')
    );
  }

  // Primary CTA foreground is white; semantic warning/success colors remain intact.
  for (const file of [
    'src/routes/_public.login.tsx',
    'src/routes/_public.cadastro.tsx',
    'src/routes/_public.recuperar-senha.tsx',
    'src/routes/_public.redefinir-senha.tsx'
  ]) {
    patchText(resolve(ws, file), (text) => text
      .replace(/(bg-(?:apois-primary|\[#F5222D\])[^"]*)\btext-black\b/g, '$1text-white')
    );
  }
}

function entregas(workspace) {
  const ws = resolve(root, workspace);
  syncPublicRasterBrand(ws);
  syncSvgBrandWrapper(ws);
  const block = `
.apois-system-theme,
.apois-customer-theme {
${vars}
  color-scheme: dark;
}
.apois-system-theme body,
.apois-customer-theme body { background: var(--background); color: var(--foreground); }
.apois-system-theme input:focus,
.apois-system-theme textarea:focus,
.apois-system-theme select:focus,
.apois-customer-theme input:focus,
.apois-customer-theme textarea:focus,
.apois-customer-theme select:focus { border-color: var(--primary-brand); }
.apois-system-theme [class*="from-primary"][class*="to-accent"],
.apois-customer-theme [class*="from-primary"][class*="to-accent"] {
  background-image: linear-gradient(135deg, var(--primary), var(--primary-brand)) !important;
  color: var(--primary-foreground) !important;
}
${legacyUtilityOverrides('.apois-system-theme')}
${legacyUtilityOverrides('.apois-customer-theme')}
`;
  for (const file of ['src/system-theme.css','src/customer-theme.css']) {
    if (existsSync(resolve(ws,file))) replaceBlock(resolve(ws,file), block);
  }

  const officialLogo = resolve(root, 'superapp/branding/apois-wordmark-v3.svg');
  if (!existsSync(officialLogo)) throw new Error('Logo oficial APOIS Brand V2 ausente');
  const logoData = readFileSync(officialLogo).toString('base64');
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 384" role="img" aria-label="APOIS">
  <image href="data:image/jpeg;base64,${logoData}" width="384" height="384" preserveAspectRatio="xMidYMid slice"/>
</svg>`;
  for (const logoFile of ['public/apois-logo.svg', 'public/apois-logo-customer.svg']) {
    const logoPath = resolve(ws, logoFile);
    if (existsSync(logoPath)) writeFileSync(logoPath, logoSvg, 'utf8');
  }
}

function motorista() {
  const ws = resolve(root, process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista');
  syncPublicRasterBrand(ws);
  syncEmbeddedBrandModule(ws);
  replaceBlock(resolve(ws, 'src/apois-motorista-theme.css'), `
html[data-app-role="motorista"],
html[data-app-role="motorista"].dark {
${vars}
  --primary-glow: ${s.primaryStrong};
  --color-status-inride: ${s.primaryBrand};
  --color-status-arrived: ${s.accent};
  --color-map-accent: ${s.primaryBrand};
  --color-online: ${s.success};
  --color-offline: ${s.textMuted};
  color-scheme: dark;
}
html[data-app-role="motorista"] body {
  background: radial-gradient(circle at 50% -15%, rgb(245 34 45 / .08), transparent 28rem), var(--background);
}
html[data-app-role="motorista"] input:focus,
html[data-app-role="motorista"] textarea:focus,
html[data-app-role="motorista"] select:focus {
  border-color: var(--primary-brand);
  box-shadow: 0 0 0 3px rgb(245 34 45 / .12);
}
html[data-app-role="motorista"] .driver-nav-active .driver-nav-indicator,
html[data-app-role="motorista"] .driver-nav-active .driver-nav-icon { color: var(--primary-brand); }
html[data-app-role="motorista"] .driver-nav-active .driver-nav-indicator { background: var(--primary-brand); }
html[data-app-role="motorista"] .driver-menu-active .driver-menu-icon {
  background: linear-gradient(145deg, ${s.primaryStrong}, ${s.primary} 58%, ${s.primaryDark});
  color: var(--primary-foreground);
}
${legacyUtilityOverrides('html[data-app-role="motorista"]')}
`);
  patchText(resolve(ws, 'src/design-system/tokens.ts'), (text) => text
    .replace('"#8DD92B"', `"${p.red}"`)
    .replace('"#5FAF1A"', `"${p.redDark}"`)
    .replace('"#05070D"', `"${p.black}"`)
    .replace('"#121826"', `"${p.blackSecondary}"`)
  );
}

function admin() {
  const ws = resolve(root, process.env.APOIS_ADMIN_WORKSPACE || '.work/admin');
  syncPublicRasterBrand(ws);
  syncEmbeddedBrandModule(ws);
  replaceBlock(resolve(ws, 'src/apois-admin-theme.css'), `
.apois-admin-theme {
${vars}
  --primary-glow: ${s.primaryStrong};
  --color-online: ${s.success};
  --color-map-accent: ${s.primaryBrand};
  color-scheme: dark;
}
.apois-admin-theme .admin-page-main,
.apois-admin-theme .admin-page-header { color: var(--text-primary); }
.apois-admin-theme input:focus,
.apois-admin-theme textarea:focus,
.apois-admin-theme select:focus { border-color: var(--primary-brand); }
${legacyUtilityOverrides('.apois-admin-theme')}
`);
}

function shell(path, partner=false) {
  if (!existsSync(path)) throw new Error(`Shell ausente: ${path}`);
  const original = readFileSync(path, 'utf8');
  const before = original.replace(
    /<meta name="theme-color" content="[^"]*" \/>/,
    `<meta name="theme-color" content="${p.black}" />`,
  );
  const id = 'apois-brand-v2-shell';
  const style = `<style id="${id}">
:root{--apois-black:${p.black};--apois-surface:${p.blackSecondary};--apois-surface-2:${p.blackElevated};--apois-red:${p.red};--apois-red-action:${s.primary};--apois-red-strong:${p.redStrong};--apois-gold:${p.gold};--apois-gold-light:${p.goldLight};--apois-text:#fff;--apois-muted:${p.textMuted};--gold:${p.gold};--gold2:${p.goldLight};--teal:${p.red}}
html,body{background:${p.black}!important;color:#fff!important}
.screen{background:radial-gradient(circle at 50% 10%,rgb(245 34 45 / .12),transparent 30rem),${p.black}!important}
.logo-mark,.logo{border-color:rgb(217 165 32 / .35)!important;box-shadow:0 0 34px rgb(217 165 32 / .12)!important}
.brand{background:linear-gradient(180deg,#fff,${p.whiteSecondary})!important;-webkit-background-clip:text!important;background-clip:text!important;color:transparent!important;text-shadow:none!important}
.service,.card{background:linear-gradient(180deg,${p.blackSecondary},${p.black})!important;border-color:rgb(245 34 45 / .42)!important}
.action,.card button{background:linear-gradient(135deg,${s.primary},${p.red})!important;color:#fff!important;box-shadow:0 12px 28px -18px rgb(245 34 45 / .55)!important}
.action:hover,.card button:hover{background:${s.primaryHover}!important}
.vehicle,.delivery,.feature .ico,.closing strong span{color:${p.gold}!important}
.corridas .badge{border-color:${p.red}!important;color:${p.red}!important}
.entregas .badge{border-color:${p.gold}!important;color:${p.gold}!important}
${partner ? '.brand h1{color:#fff}.brand p{color:'+p.textMuted+'}' : ''}
</style>`;
  let after = before.replace(new RegExp(`<style id="${id}">[\\s\\S]*?<\\/style>`), style);
  if (!after.includes(`id="${id}"`)) after = after.replace('</head>', `${style}\n</head>`);
  writeFileSync(path, after, 'utf8');
}

switch (target) {
  case 'corridas': passenger(); break;
  case 'entregas': entregas('.work/entregas'); break;
  case 'entregador': entregas(process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador'); break;
  case 'motorista': motorista(); break;
  case 'admin': admin(); break;
  case 'shell-client': shell(resolve(root, process.argv[3] || 'superapp/shell/index.html'), false); break;
  case 'shell-partner': shell(resolve(root, process.argv[3] || 'superapp/partner-shell/index.html'), true); break;
  default: throw new Error(`Target desconhecido: ${target}`);
}

console.log(`[OK] APOIS Brand V2 aplicado: ${target}`);
