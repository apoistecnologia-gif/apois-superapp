import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const workspace = resolve(root, '.work/motorista');
const hardenerEnv = { ...process.env, APOIS_MOTORISTA_WORKSPACE: '.work/motorista' };

function run(bin, args, cwd = root, env = process.env) {
  const result = spawnSync(bin, args, { cwd, stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const corridasUrl = process.env.CORRIDAS_VITE_SUPABASE_URL?.trim();
const corridasKey = process.env.CORRIDAS_VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!corridasUrl || !corridasKey) {
  console.error('[FAIL] motorista: variáveis CORRIDAS_VITE_SUPABASE_* ausentes');
  process.exit(1);
}
if (corridasUrl.replace(/\/$/, '') !== 'https://tbbzkrfupmqdywnzgnms.supabase.co') {
  console.error('[FAIL] motorista: Supabase informado não é o projeto Corridas canônico');
  process.exit(1);
}

// O storageKey padrão do supabase-js é sb-<project-ref>-auth-token.
// Derivar da URL usada no build evita que a ponte leia sessões de outro projeto.
const corridasProjectHost = new URL(corridasUrl).hostname;
if (!/^[a-z0-9]{20}\.supabase\.co$/.test(corridasProjectHost)) {
  throw new Error('[FAIL] motorista: URL Supabase inválida para storage da sessão');
}
const corridasAuthStorageKey = 'sb-' + corridasProjectHost.split('.')[0] + '-auth-token';
// Validar identidade/escopo da chave sem aceitar .env.mobile protegido como fonte canônica.
run(process.execPath, [resolve(root, 'scripts/verify-corridas-build-env.mjs')]);

run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-motorista-flags-offline-v1.test.mjs')]);
run(process.execPath, [resolve(root, 'scripts/prepare-workspace.mjs'), 'motorista']);
for (const script of [
  'harden-motorista-auth.mjs',
  'harden-motorista-flags-offline-v1.mjs',
  'harden-motorista-document-boundary.mjs',
  'harden-motorista-provider-boundary.mjs',
  'harden-motorista-finance-boundary.mjs',
  'harden-partner-motorista-direct-earnings.mjs',
]) {
  run(process.execPath, [resolve(root, `scripts/${script}`)], root, hardenerEnv);
}
run(process.execPath, [resolve(root, 'scripts/fix-report04-driver-document-reconciliation-v1.mjs')], root, hardenerEnv);

// Isola o documento SSR da rota raiz no build client-only: index.mobile.html
// já fornece html/head/body/#root. Reutiliza o hardener validado no Parceiro.
run(process.execPath, [resolve(root, 'scripts/harden-partner-motorista-mobile-base.mjs')], root, hardenerEnv);

// O bundle embutido é acessado por #/motorista/* dentro do shell.
// O código-fonte standalone continua usando browser history.
run(process.execPath, [resolve(root, 'scripts/harden-motorista-embedded-hash-router.mjs')], root, hardenerEnv);
run(process.execPath, [resolve(root, 'scripts/harden-motorista-feature-flags-rejection.mjs')], root, hardenerEnv);
run(process.execPath, [resolve(root, 'scripts/harden-motorista-history-recovery.mjs')], root, hardenerEnv);
run(process.execPath, [resolve(root, 'scripts/fix-motorista-history-cursor-v1.mjs')], root, hardenerEnv);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-motorista-history-cursor-v1.test.mjs')]);
run(process.execPath, [resolve(root, 'scripts/harden-motorista-registration-insert-only.mjs')], root, hardenerEnv);
run(process.execPath, [resolve(root, 'scripts/harden-motorista-document-photo-types.mjs')], root, hardenerEnv);
run(process.execPath, [resolve(root, 'scripts/fix-partner-admin-finance-refresh-v2.mjs')], root, hardenerEnv);
run(process.execPath, [resolve(root, 'scripts/fix-report03-motorista-notifications-v1.mjs')], root, hardenerEnv);
// RV-07 / CV-023: the standalone embedded Motorista has its own build path.
// Only its generated status presentation is transformed, never membership or eligibility.
run(process.execPath, [resolve(root, 'scripts/fix-apois-financial-status-visual07-v1.mjs'), 'motorista'], root, hardenerEnv);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-apois-financial-status-visual07-v1.test.mjs')]);
if (!readFileSync(resolve(workspace, 'src/routes/motorista.assinatura.tsx'), 'utf8').includes('APOIS_CV07_DRIVER_MEMBERSHIP_STATUS_V1')) {
  throw new Error('[FAIL] CV07 Motorista monthly status patch missing');
}
run(process.execPath, [resolve(root, 'scripts/fix-report03-native-push-permission-v1.mjs')], root, hardenerEnv);

const env = {
  ...process.env,
  APOIS_MOTORISTA_WORKSPACE: '.work/motorista',
  VITE_SUPABASE_URL: corridasUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: corridasKey,
  VITE_ENABLE_NATIVE_PUSH: process.env.APOIS_SUPERAPP_RIDES_PUSH_ENABLED === '1' ? 'true' : 'false',
};

if (readFileSync(resolve(workspace, 'src/routes/__root.tsx'), 'utf8').includes('shellComponent: RootShell')) {
  throw new Error('[FAIL] motorista embutido: documento SSR residual no build client-only');
}
if (!readFileSync(resolve(workspace, 'src/mobile.tsx'), 'utf8').includes('history: createHashHistory()')) {
  throw new Error('[FAIL] motorista embutido: hash history não aplicada antes do build');
}

// QA218: mostrar apenas zonas agregadas de pedidos e passageiros opt-in.
run(process.execPath, [resolve(root, 'scripts/harden-partner-motorista-demand-map-v1.mjs')], root, hardenerEnv);
run(process.execPath, ['--test', resolve(root, 'scripts/qa/test-motorista-passenger-hotspots-qa218.test.mjs')], root, hardenerEnv);
run('bun', ['install'], workspace, env);
run(process.execPath, [resolve(root, 'scripts/verify-apois-report02-integrity-v1.mjs'), 'finance'], root, hardenerEnv);
run('bun', ['run', 'typecheck'], workspace, env);
run('bun', ['run', 'build:motorista'], workspace, env);
run(process.execPath, [resolve(root, 'scripts/audit-motorista-release-surface.mjs')], root, env);

const indexPath = resolve(workspace, 'dist/client/index.html');
let html = readFileSync(indexPath, 'utf8');
if (!html.includes('data-apois-superapp-bridge')) {
  const bridge = `
<script data-apois-superapp-bridge>
(() => {
  const shellUrl='../../index.html';
  const routeStorageKey='apois-superapp:last-route:motorista';
  // supabase-js persiste a sessão por padrão em sb-<project-ref>-auth-token.\n  const authStorageKey='${corridasAuthStorageKey}';
  const appPlugin=window.Capacitor?.Plugins?.App;
  function route(){return window.location.hash||'#/motorista/app';}
  function persist(){try{localStorage.setItem(routeStorageKey,route());}catch{}}
  function hasSession(){try{const raw=localStorage.getItem(authStorageKey);if(!raw)return false;const parsed=JSON.parse(raw);return Boolean(parsed?.access_token||parsed?.currentSession?.access_token||parsed?.session?.access_token);}catch{return false;}}
  function publicRoute(){const value=route();return ['/motorista/login','/motorista/cadastro','/motorista/recuperar-senha','/motorista/redefinir-senha'].some((part)=>value.includes(part));}
  function enforce(){if(hasSession()||publicRoute())return;try{localStorage.removeItem(routeStorageKey);}catch{}window.location.replace('#/motorista/login');}
  persist();window.addEventListener('hashchange',persist);window.addEventListener('pagehide',persist);
  if(appPlugin){
    appPlugin.addListener('appStateChange',({isActive})=>{if(isActive)enforce();else persist();}).catch(()=>undefined);
    appPlugin.addListener('backButton',({canGoBack})=>{const value=route();if(['#/motorista/app','#/motorista/login','#/'].includes(value)||(!canGoBack&&!value)){persist();window.location.replace(shellUrl);return;}window.history.back();}).catch(()=>undefined);
  }
  window.setTimeout(enforce,350);
})();
</script>`;
  html = html.includes('</body>') ? html.replace('</body>', `${bridge}\n</body>`) : `${html}\n${bridge}`;
  writeFileSync(indexPath, html);
}

const executable = readFileSync(indexPath, 'utf8');
for (const forbidden of [
  'mercadopago',
  'Mercado Pago',
  'asaas-create-driver-membership',
  'asaas-create-driver-subaccount',
  'driver-membership-checkout',
  '/debug/motorista-auth',
  '/dev-diagnostics',
  '/dev/rating-test',
  '/diagnostico',
  '/map-test',
]) {
  if (executable.toLowerCase().includes(forbidden.toLowerCase())) {
    console.error(`[FAIL] motorista: index final contém superfície proibida (${forbidden})`);
    process.exit(1);
  }
}
console.log('[OK] motorista: typecheck + build isolado concluídos com auth/document/provider boundary');
