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
const MARK_SOURCE = resolve(root, 'superapp/branding/apois-mark-v3.svg');

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
  if (!existsSync(MARK_SOURCE)) throw new Error(`Símbolo oficial APOIS ausente: ${MARK_SOURCE}`);
  writeFileSync(resolve(publicDir, 'apois-wordmark-v3.svg'), requireBrandSource());
  writeFileSync(resolve(publicDir, 'apois-mark-v3.svg'), readFileSync(MARK_SOURCE));
  syncDocumentBrand(ws);
}

function syncDocumentBrand(ws) {
  const icon = '<link rel="icon" type="image/svg+xml" href="./apois-mark-v3.svg" />';
  const bootstrap = `<style id="apois-brand-bootstrap">
#apois-fallback-loading { background: var(--apois-background, ${p.background}) !important; color: var(--apois-text, ${s.textPrimary}) !important; }
#apois-fallback-loading p { color: var(--apois-primary, ${p.primary}) !important; }
</style>`;
  for (const file of ['index.html', 'index.mobile.html']) {
    patchText(resolve(ws, file), source => {
      let next = source.replace(/<meta\b(?=[^>]*\bname=["']theme-color["'])[^>]*>/gi, `<meta name="theme-color" content="${p.white}" />`);
      const oldIcon = /<link\b(?=[^>]*\brel=["'](?:shortcut )?icon["'])[^>]*>/gi;
      if (oldIcon.test(next)) next = next.replace(oldIcon, icon);
      else next = next.replace('</head>', `${icon}\n</head>`);
      const oldBootstrap = /<style id="apois-brand-bootstrap">[\s\S]*?<\/style>/;
      if (oldBootstrap.test(next)) next = next.replace(oldBootstrap, bootstrap);
      else next = next.replace('</head>', `${bootstrap}\n</head>`);
      return next;
    });
  }
  // Metadata SSR: somente href/type de favicon e a cor do chrome do navegador.
  // Os builds móveis já normalizam os links absolutos do HTML renderizado.
  patchText(resolve(ws, 'src/routes/__root.tsx'), source => {
    let next = source.replace('{ name: "theme-color", content: "#05070D" }', `{ name: "theme-color", content: "${p.white}" }`);
    for (const href of ['/favicon.png', './favicon.png', '/favicon.ico', './favicon.ico']) {
      for (const type of ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon']) {
        next = next.replace(`{ rel: "icon", href: "${href}", type: "${type}" }`, '{ rel: "icon", href: "/apois-mark-v3.svg", type: "image/svg+xml" }');
      }
    }
    if (!/rel:\s*["']icon["']/.test(next)) {
      next = next.replace('{ rel: "stylesheet", href: appCss },', '{ rel: "icon", href: "/apois-mark-v3.svg", type: "image/svg+xml" },\n      { rel: "stylesheet", href: appCss },');
    }
    return next;
  });
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
  --apois-primary: ${p.primary};
  --apois-primary-hover: ${p.primaryHover};
  --apois-primary-pressed: ${p.primaryPressed};
  --apois-primary-soft: ${p.primarySoft};
  --apois-black: ${p.black};
  --apois-black-secondary: ${p.blackSecondary};
  --apois-white: ${p.white};
  --apois-background: ${p.background};
  --apois-surface: ${s.surface};
  --apois-surface-secondary: ${p.surfaceSecondary};
  --apois-border: ${p.border};
  --apois-text: ${s.textPrimary};
  --apois-text-secondary: ${p.textSecondary};
  --apois-text-disabled: ${p.textDisabled};

  /* aliases técnicos temporários para hardeners antigos */
  --apois-red: ${p.primary};
  --apois-red-strong: ${p.primary};
  --apois-red-dark: ${p.primaryHover};
  --apois-white-secondary: ${p.background};
  --apois-text-muted: ${p.textDisabled};
  --apois-gold: ${p.primary};
  --apois-gold-light: ${p.primarySoft};
  --apois-gold-dark: ${p.primaryHover};

  --background: ${s.background};
  --foreground: ${s.textPrimary};
  --surface: ${s.surface};
  --surface-2: ${p.surfaceSecondary};
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
  --muted: ${p.surfaceSecondary};
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
  --sidebar-accent: ${s.accent};
  --sidebar-accent-foreground: ${s.accentForeground};
  --sidebar-border: ${s.border};
  --sidebar-ring: ${s.ring};
`;

const compatibility = `
input:focus, textarea:focus, select:focus { border-color: var(--primary-brand); }
::selection { background: color-mix(in srgb, var(--primary-brand) 30%, transparent); color: var(--text-primary); }
`;

// Somente ações já identificadas como primárias da APOIS. Google, controles
// semânticos, switches e elementos do mapa não participam destes seletores.
function primaryControlStates(scope = '') {
  const q = scope ? `${scope} ` : '';
  const driverLegacy = scope === 'html[data-app-role="motorista"]' ? ', [class~="bg-[#F6BE1C]"]' : '';
  const control = `${q}:is(button, a[role="button"]):is([class~="bg-primary"], [class~="bg-apois-primary"], [class~="bg-[#E51B23]"], [class~="bg-[var(--primary)]"]${driverLegacy}):not([role="switch"]):not([role="checkbox"]):not([role="radio"]):not(.gm-style *)`;
  const enabled = `${control}:not(:disabled):not([aria-disabled="true"])`;
  return `
/* APOIS_PRIMARY_CONTROL_STATES */
${control} { background-color: var(--apois-primary) !important; color: var(--apois-white) !important; }
@media (hover: hover) {
  ${enabled}:hover { background-color: var(--apois-primary-hover) !important; }
}
${enabled}:active { background-color: var(--apois-primary-pressed) !important; }
${control}:is(:disabled, [aria-disabled="true"]) {
  background-color: var(--apois-surface-secondary) !important;
  background-image: none !important;
  color: var(--apois-text-disabled) !important;
  box-shadow: none !important;
  opacity: 1;
}
`;
}

function legacyUtilityOverrides(scope) {
  const q = scope ? `${scope} ` : '';
  const old = ['#6A1B9A','#1F7894','#35A9C9','#FFD700','#F6B900','#FACC15','#F6BE1C'];
  const text = old.map(c => `${q}[class~="text-[${c}]"]`).join(',\n');
  const bg = old.map(c => `${q}[class~="bg-[${c}]"]`).join(',\n');
  const border = old.map(c => `${q}[class~="border-[${c}]"]`).join(',\n');
  return `
${text} { color: var(--primary-brand) !important; }
${bg} { background: var(--primary) !important; color: var(--primary-foreground) !important; }
${border} { border-color: var(--primary-brand) !important; }
`;
}

function driverBrandDetails() {
  const q = 'html[data-app-role="motorista"]';
  // Classes do branding dourado nos overlays/CTAs dos hardeners existentes.
  // Mantemos as classes e todos os seletores usados pelos audits.
  const softBackgrounds = [8, 10, 12].map(alpha =>
    `${q} [class~="bg-[#F6BE1C]/${alpha}"] { background-color: color-mix(in srgb, var(--apois-primary) ${alpha}%, transparent) !important; }`
  ).join('\n');
  const brandBorders = [15, 18, 20, 25, 30, 55].map(alpha =>
    `${q} [class~="border-[#F6BE1C]/${alpha}"] { border-color: color-mix(in srgb, var(--apois-primary) ${alpha}%, transparent) !important; }`
  ).join('\n');
  const brandRings = [20, 40].flatMap(alpha => ['', 'focus-visible:', 'focus-within:'].map(prefix =>
    `${q} [class~="${prefix}ring-[#F6BE1C]/${alpha}"] { --tw-ring-color: color-mix(in srgb, var(--apois-primary) ${alpha}%, transparent); }`
  )).join('\n');
  return `
/* APOIS_DRIVER_BRAND_DETAILS */
${q} .surface-card { background: var(--apois-surface); border-color: var(--apois-border); box-shadow: 0 12px 28px rgb(17 17 17 / .08); }
${q} ::selection { background: var(--apois-primary-soft); color: var(--apois-text); }
${q} *:not(.gm-style *) { scrollbar-color: color-mix(in srgb, var(--apois-primary) 28%, transparent) transparent; }
${q} *:not(.gm-style *)::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--apois-primary) 28%, transparent); }
${q} .driver-nav-active .driver-nav-icon { background: var(--apois-primary-soft); }
${q} .driver-nav-active .driver-nav-indicator { box-shadow: 0 4px 12px rgb(17 17 17 / .08); }
${q} .driver-menu-active .driver-menu-icon { box-shadow: 0 8px 20px rgb(17 17 17 / .08); }
${q} .driver-menu-active p:first-of-type { color: var(--apois-text); }
${q} :is(button, a):not(.gm-style *):focus-visible { outline-color: var(--apois-primary); }
${q} :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), textarea, select):not(.gm-style *) {
  background-color: var(--apois-surface);
  color: var(--apois-text);
  border-color: var(--apois-border);
  caret-color: var(--apois-primary);
}
${q} :is(input, textarea):not(.gm-style *)::placeholder { color: var(--apois-text-disabled); }
${q} [class~="ring-[#F6BE1C]"] { --tw-ring-color: var(--apois-primary); }
${softBackgrounds}
${brandBorders}
${brandRings}
`;
}

function appCss(scope=':root, .dark') {
  return `
${scope} {
${vars}
  color-scheme: light;
}
body { background: var(--background); color: var(--foreground); }
${compatibility}
${primaryControlStates()}
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
  --color-secondary: ${p.blackSecondary};
  --color-surface: ${s.surface};
  --color-apois-primary: ${s.primary};
  --color-apois-primary-hover: ${s.primaryHover};
  --color-apois-red: ${s.primaryBrand};
  --color-apois-gold: ${s.primary};
  --color-apois-gold-light: ${s.primarySoft};
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
${primaryControlStates()}
`);

  walkText(resolve(ws, 'src'), (text) => text
    .replaceAll('apois-yellow', 'apois-primary')
    .replaceAll('#ffb800', p.primary)
    .replaceAll('#FFB800', p.primary)
    .replaceAll('#ff5c00', p.primary)
    .replaceAll('#FF5C00', p.primary)
    .replaceAll('#F5222D', p.primary)
    .replaceAll('#f5222d', p.primary)
    .replaceAll('#FF1F2D', p.primary)
    .replaceAll('#ff1f2d', p.primary)
    .replaceAll('#9E1018', p.primaryHover)
    .replaceAll('#9e1018', p.primaryHover)
    .replaceAll('#D9A520', p.primary)
    .replaceAll('#d9a520', p.primary)
    .replaceAll('#F4C44E', p.primarySoft)
    .replaceAll('#f4c44e', p.primarySoft)
    .replaceAll('#A97808', p.primaryHover)
    .replaceAll('#a97808', p.primaryHover)
    .replaceAll('#08090B', p.background)
    .replaceAll('#08090b', p.background)
    .replaceAll('#111318', s.surface)
    .replaceAll('#111318'.toLowerCase(), s.surface)
    .replaceAll('#181A20', p.surfaceSecondary)
    .replaceAll('#181a20', p.surfaceSecondary)
    .replaceAll('#07090d', p.background)
    .replaceAll('#0b0e14', s.surface)
    .replaceAll('#A6A8AE', p.textSecondary)
    .replaceAll('#a6a8ae', p.textSecondary)
    .replaceAll('rgba(255,184,0', 'rgba(229,27,35')
    .replaceAll('rgba(255, 184, 0', 'rgba(229, 27, 35')
    .replaceAll('rgba(245,34,45', 'rgba(229,27,35')
    .replaceAll('rgba(245, 34, 45', 'rgba(229, 27, 35')
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
  color-scheme: light;
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
${primaryControlStates('.apois-system-theme')}
${primaryControlStates('.apois-customer-theme')}
`;
  for (const file of ['src/system-theme.css','src/customer-theme.css']) {
    if (existsSync(resolve(ws,file))) replaceBlock(resolve(ws,file), block);
  }

  const officialLogo = resolve(root, 'superapp/branding/apois-wordmark-v3.svg');
  if (!existsSync(officialLogo)) throw new Error('Logo oficial APOIS Brand V2 ausente');
  const logoData = readFileSync(officialLogo).toString('base64');
  const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 384" role="img" aria-label="APOIS">
  <image href="data:image/svg+xml;base64,${logoData}" width="384" height="384" preserveAspectRatio="xMidYMid meet"/>
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
  color-scheme: light;
}
html[data-app-role="motorista"] body {
  background: radial-gradient(circle at 50% -15%, rgb(229 27 35 / .055), transparent 28rem), var(--background);
}
html[data-app-role="motorista"] input:focus,
html[data-app-role="motorista"] textarea:focus,
html[data-app-role="motorista"] select:focus {
  border-color: var(--primary-brand);
  box-shadow: 0 0 0 3px rgb(229 27 35 / .12);
}
html[data-app-role="motorista"] .driver-nav-active .driver-nav-indicator,
html[data-app-role="motorista"] .driver-nav-active .driver-nav-icon { color: var(--primary-brand); }
html[data-app-role="motorista"] .driver-nav-active .driver-nav-indicator { background: var(--primary-brand); }
html[data-app-role="motorista"] .driver-menu-active .driver-menu-icon {
  background: linear-gradient(145deg, ${s.primaryStrong}, ${s.primary} 58%, ${s.primaryDark});
  color: var(--primary-foreground);
}
${legacyUtilityOverrides('html[data-app-role="motorista"]')}
${driverBrandDetails()}
${primaryControlStates('html[data-app-role="motorista"]')}
`);
  patchText(resolve(ws, 'src/design-system/tokens.ts'), (text) => text
    .replace('"#8DD92B"', `"${p.red}"`)
    .replace('"#5FAF1A"', `"${p.redDark}"`)
    .replace('"#05070D"', `"${p.background}"`)
    .replace('"#121826"', `"${s.surface}"`)
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
  color-scheme: light;
}
.apois-admin-theme .admin-page-main,
.apois-admin-theme .admin-page-header { color: var(--text-primary); }
.apois-admin-theme input:focus,
.apois-admin-theme textarea:focus,
.apois-admin-theme select:focus { border-color: var(--primary-brand); }
${legacyUtilityOverrides('.apois-admin-theme')}
${primaryControlStates('.apois-admin-theme')}
`);
}

function shell(path, partner=false) {
  if (!existsSync(path)) throw new Error(`Shell ausente: ${path}`);
  const original = readFileSync(path, 'utf8');
  const before = original.replace(
    /<meta name="theme-color" content="[^"]*" \/>/,
    `<meta name="theme-color" content="${p.white}" />`,
  );
  const id = 'apois-brand-v2-shell';
  const style = `<style id="${id}">
:root{
  --apois-primary:${p.primary};
  --apois-primary-hover:${p.primaryHover};
  --apois-primary-pressed:${p.primaryPressed};
  --apois-primary-soft:${p.primarySoft};
  --apois-white:${p.white};
  --apois-black:${p.black};
  --apois-black-secondary:${p.blackSecondary};
  --apois-background:${p.background};
  --apois-surface:${s.surface};
  --apois-surface-secondary:${p.surfaceSecondary};
  --apois-border:${p.border};
  --apois-text:${s.textPrimary};
  --apois-text-disabled:${p.textDisabled};
  --apois-muted:${p.textSecondary};
  --red:${p.primary};
  --red-strong:${p.primary};
  --gold:${p.primary};
  --gold2:${p.primarySoft};
  --teal:${p.primary}
}
html,body{background:${p.background}!important;color:${s.textPrimary}!important;color-scheme:light!important}
.screen,.partner-screen{background:${p.background}!important;color:${s.textPrimary}!important}
.brand,.brand-name,.partner-heading h1,.role-title strong{color:${s.textPrimary}!important;text-shadow:none!important}
.brand-kicker,.partner-tagline,.foot{color:${p.textSecondary}!important}
.service,.card,.role-card{
  background:${s.surface}!important;
  border-color:${p.border}!important;
  box-shadow:0 10px 28px rgb(17 17 17 / .08)!important
}
.action,.card button,.role-card button{
  background:${p.primary}!important;
  color:${p.white}!important;
  box-shadow:0 10px 24px rgb(229 27 35 / .18)!important
}
.action:hover,.card button:hover,.role-card button:hover{background:${p.primaryHover}!important}
.action:not(:disabled):not([aria-disabled="true"]):active,
.card button:not(:disabled):not([aria-disabled="true"]):active,
.role-card button:not(:disabled):not([aria-disabled="true"]):active{background:var(--apois-primary-pressed)!important}
.action:is(:disabled,[aria-disabled="true"]),
.card button:is(:disabled,[aria-disabled="true"]),
.role-card button:is(:disabled,[aria-disabled="true"]){background:var(--apois-surface-secondary)!important;color:var(--apois-text-disabled)!important;box-shadow:none!important;opacity:1}
.corridas .badge,.entregas .badge,.role-icon{border-color:${p.primary}!important;color:${p.primary}!important;background:${p.primarySoft}!important}
.vehicle,.delivery,.feature .ico,.closing strong span,.partner-heading h1 span,.role-title strong span{color:${p.primary}!important}
${partner ? '.partner-screen::before,.partner-screen::after{opacity:.08!important}.partner-heading p,.role-copy{color:'+p.textSecondary+'!important}' : ''}
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

console.log(`[OK] Identidade visual APOIS unificada aplicada: ${target}`);
