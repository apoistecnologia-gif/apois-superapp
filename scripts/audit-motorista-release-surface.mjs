import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista';
const workRoot = resolve(root, workspace);
const mobileRouteTreePath = resolve(workRoot, 'src/mobile-route-tree.motorista.ts');
const driverProfilePath = resolve(workRoot, 'src/lib/driverProfile.ts');
const distRoot = resolve(workRoot, 'dist/client');

let failed = false;
function fail(message) { failed = true; console.error(`[FAIL] ${message}`); }
function ok(message) { console.log(`[OK] ${message}`); }

if (!existsSync(mobileRouteTreePath)) {
  fail(`árvore mobile do Motorista ausente em ${workspace}`);
} else {
  const tree = readFileSync(mobileRouteTreePath, 'utf8');
  for (const forbidden of [
    './routes/debug.motorista-auth',
    './routes/dev-diagnostics',
    './routes/dev.rating-test',
    './routes/diagnostico',
    './routes/map-test',
    '/debug/motorista-auth',
    '/dev-diagnostics',
    '/dev/rating-test',
    "'/diagnostico'",
    "'/map-test'",
  ]) {
    if (tree.includes(forbidden)) fail(`rota de diagnóstico entrou na árvore mobile (${forbidden})`);
  }
  if (!failed) ok('árvore mobile release não importa rotas debug/dev/diagnóstico');
}

if (!existsSync(driverProfilePath)) {
  fail(`driverProfile.ts ausente em ${workspace}`);
} else {
  const profile = readFileSync(driverProfilePath, 'utf8');
  for (const forbidden of [
    'asaas-create-driver-subaccount',
    'ensureApprovedDriverAsaasSubaccount',
    'asaasSubaccountProvisioningAttempted',
  ]) {
    if (profile.includes(forbidden)) fail(`provisionamento de gateway permanece no perfil do motorista (${forbidden})`);
  }
  if (!failed) ok('perfil do motorista não provisiona gateway legado');
}

const executableExtensions = new Set(['.js', '.mjs', '.html']);
function executableFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const path = resolve(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...executableFiles(path));
    else if (executableExtensions.has(extname(entry))) out.push(path);
  }
  return out;
}

if (existsSync(distRoot)) {
  const forbiddenBundleMarkers = [
    '/debug/motorista-auth',
    '/dev-diagnostics',
    '/dev/rating-test',
    '/diagnostico',
    '/map-test',
    'asaas-create-driver-subaccount',
    'asaas-create-driver-membership',
    'driver-membership-checkout',
    'mercadopago-oauth-start',
    'Conectar Mercado Pago',
    'Desconectar Mercado Pago',
    'openpix',
    'pagbank',
  ];
  const files = executableFiles(distRoot);
  for (const path of files) {
    const content = readFileSync(path, 'utf8');
    for (const marker of forbiddenBundleMarkers) {
      if (content.toLowerCase().includes(marker.toLowerCase())) {
        fail(`bundle Motorista contém superfície proibida (${marker}) em ${path.slice(workRoot.length + 1)}`);
      }
    }
  }
  if (!failed) ok(`bundle Motorista validado em ${files.length} artefatos executáveis`);
} else {
  console.log('[INFO] bundle Motorista ainda não existe; validação de dist será executada após o build');
}

if (failed) process.exit(1);
ok(`superfície release do Motorista validada em ${workspace}`);
