import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const cwd = resolve(root, workspace);
const vitePath = resolve(cwd, 'vite.mobile.config.ts');
const indexPath = resolve(cwd, 'index.mobile.html');
const packagePath = resolve(cwd, 'package.json');
const routeIndexPath = resolve(cwd, 'src/routes/index.tsx');
const boundariesPath = resolve(cwd, 'src/components/routing/DefaultBoundaries.tsx');
const shellPath = resolve(root, 'superapp/partner-shell/index.html');

for (const path of [vitePath, indexPath, packagePath, routeIndexPath, boundariesPath, shellPath]) {
  if (!existsSync(path)) throw new Error(`[FAIL] Motorista Parceiro: entrada/runtime ausente: ${path}`);
}

// O módulo Motorista é empacotado em modules/motorista/. Qualquer base absoluta
// faz o WebView procurar chunks no diretório raiz do host e cai no ErrorBoundary.
let vite = readFileSync(vitePath, 'utf8');
if (/\bbase\s*:\s*["'][^"']*["']\s*,?/.test(vite)) {
  vite = vite.replace(/\bbase\s*:\s*["'][^"']*["']\s*,?/, 'base: "./",');
} else {
  const returnConfig = /return\s*\{\s*\n/;
  if (!returnConfig.test(vite)) throw new Error('[FAIL] Motorista Parceiro: bloco return do Vite mobile não encontrado.');
  vite = vite.replace(returnConfig, (match) => `${match}    base: "./",\n`);
}
writeFileSync(vitePath, vite, 'utf8');

let html = readFileSync(indexPath, 'utf8');
html = html
  .replace(/<base\s+href=["'][^"']*["']\s*\/?\s*>/gi, '<base href="./">')
  .replace(/(<(?:script|link)\b[^>]*(?:src|href)=["'])\/(?!\/)/gi, '$1./');
if (!/<base\b/i.test(html)) {
  html = html.replace(/<head(\s[^>]*)?>/i, (head) => `${head}\n    <base href="./">`);
}
writeFileSync(indexPath, html, 'utf8');

// Em cold start, deixe o TanStack inicializar a partir da raiz do módulo e só
// então faça o redirect interno do papel Motorista. Abrir o hash profundo antes
// do bootstrap do router pode cair no defaultErrorComponent mesmo com os chunks
// corretos no WebView.
let routeIndex = readFileSync(routeIndexPath, 'utf8');
if (!routeIndex.includes('APP_ROLE === "driver"')) {
  const passengerGuard = /    if \(APP_ROLE === "passenger"\) \{\s*\n      throw redirect\(\{ to: "\/passageiro\/login", replace: true \}\);\s*\n    \}/;
  if (!passengerGuard.test(routeIndex)) {
    throw new Error('[FAIL] Motorista Parceiro: guard da rota raiz não encontrado para inserir bootstrap do Motorista.');
  }
  routeIndex = routeIndex.replace(
    passengerGuard,
    (guard) => `${guard}\n    if (APP_ROLE === "driver") {\n      throw redirect({ to: "/motorista/login", replace: true });\n    }`,
  );
}
writeFileSync(routeIndexPath, routeIndex, 'utf8');

// O seletor Parceiro também deve abrir a raiz limpa do módulo. A URL profunda
// continua reservada ao operationalUrls, usado para retomar Motorista ONLINE.
let shell = readFileSync(shellPath, 'utf8');
shell = shell.replace(
  "motorista:'./modules/motorista/index.html#/motorista/login'",
  "motorista:'/modules/motorista/index.html'",
);
shell = shell.replace(
  "motorista:'./modules/motorista/index.html'",
  "motorista:'/modules/motorista/index.html'",
);
writeFileSync(shellPath, shell, 'utf8');

// Se ainda houver uma exceção real de runtime, o APK precisa indicar ao menos a
// categoria segura do erro. Não expomos message, stack, URL, token ou parâmetros.
let boundaries = readFileSync(boundariesPath, 'utf8');
if (!boundaries.includes('APOIS_MOTORISTA_SAFE_ERROR_CODE')) {
  const routerMarker = '  const router = useRouter();';
  if (!boundaries.includes(routerMarker)) {
    throw new Error('[FAIL] Motorista Parceiro: DefaultErrorComponent não possui marcador do router.');
  }
  boundaries = boundaries.replace(
    routerMarker,
    `${routerMarker}\n  const APOIS_MOTORISTA_SAFE_ERROR_CODE = \`MOTORISTA-\${(error instanceof Error ? error.name : "Error")\n    .replace(/[^A-Za-z0-9_-]/g, "")\n    .slice(0, 24)\n    .toUpperCase() || "ERROR"}\`;`,
  );
  const errorParagraph = `        <p className="mt-2 text-sm text-muted-foreground">\n          Não conseguimos carregar esta página. Tente novamente em instantes.\n        </p>`;
  if (!boundaries.includes(errorParagraph)) {
    throw new Error('[FAIL] Motorista Parceiro: texto do DefaultErrorComponent não encontrado para diagnóstico seguro.');
  }
  boundaries = boundaries.replace(
    errorParagraph,
    `${errorParagraph}\n        <p className="mt-2 text-[11px] font-semibold tracking-wide text-muted-foreground/70">\n          Código: {APOIS_MOTORISTA_SAFE_ERROR_CODE}\n        </p>`,
  );
}
writeFileSync(boundariesPath, boundaries, 'utf8');

// Normalização pós-build: além do Vite base relativo, valida os arquivos reais
// antes que o shell copie o módulo para modules/motorista.
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
const buildKey = pkg.scripts?.['build:motorista'] ? 'build:motorista' : null;
if (!buildKey) throw new Error('[FAIL] Motorista Parceiro: script build:motorista não encontrado.');
const normalizer = 'node ../../scripts/normalize-partner-motorista-dist.mjs';
if (!pkg.scripts[buildKey].includes('normalize-partner-motorista-dist.mjs')) {
  pkg.scripts[buildKey] = `${pkg.scripts[buildKey]} && ${normalizer}`;
}
writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const finalVite = readFileSync(vitePath, 'utf8');
const finalIndex = readFileSync(indexPath, 'utf8');
const finalRouteIndex = readFileSync(routeIndexPath, 'utf8');
const finalShell = readFileSync(shellPath, 'utf8');
const finalBoundaries = readFileSync(boundariesPath, 'utf8');

if (!finalVite.includes('base: "./"')) {
  throw new Error('[FAIL] Motorista Parceiro: Vite mobile não ficou com base relativa.');
}
if (!finalIndex.includes('<base href="./">')) {
  throw new Error('[FAIL] Motorista Parceiro: index mobile não ficou ancorado no diretório do módulo.');
}
if (!finalRouteIndex.includes('APP_ROLE === "driver"') || !finalRouteIndex.includes('to: "/motorista/login"')) {
  throw new Error('[FAIL] Motorista Parceiro: raiz não redireciona internamente ao login do Motorista.');
}
if (!finalShell.includes("motorista:'/modules/motorista/index.html'")) {
  throw new Error('[FAIL] Motorista Parceiro: seletor ainda não abre a raiz limpa do módulo.');
}
if (finalShell.includes("motorista:'./modules/motorista/index.html") || finalShell.includes("motorista:'/modules/motorista/index.html#/motorista/login'")) {
  throw new Error('[FAIL] Motorista Parceiro: cold start ainda usa caminho relativo ou hash profundo de login.');
}
if (!finalBoundaries.includes('APOIS_MOTORISTA_SAFE_ERROR_CODE')) {
  throw new Error('[FAIL] Motorista Parceiro: diagnóstico seguro do ErrorBoundary não foi aplicado.');
}

console.log('[OK] Motorista Parceiro: bootstrap inicia na raiz, redireciona internamente ao login e mantém diagnóstico sanitizado.');
