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
if (!corridasUrl.includes('vqtucstyduxrqjgyigfk.supabase.co')) {
  console.error('[FAIL] motorista: Supabase informado não é o projeto Corridas canônico');
  process.exit(1);
}

run(process.execPath, [resolve(root, 'scripts/prepare-workspace.mjs'), 'motorista']);
for (const script of [
  'harden-motorista-auth.mjs',
  'harden-motorista-document-boundary.mjs',
  'harden-motorista-provider-boundary.mjs',
  'harden-motorista-finance-boundary.mjs',
  'harden-motorista-payment-wait.mjs',
  'harden-partner-motorista-direct-earnings.mjs',
]) {
  run(process.execPath, [resolve(root, `scripts/${script}`)], root, hardenerEnv);
}

const env = {
  ...process.env,
  APOIS_MOTORISTA_WORKSPACE: '.work/motorista',
  VITE_SUPABASE_URL: corridasUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: corridasKey,
  VITE_ENABLE_NATIVE_PUSH: process.env.APOIS_SUPERAPP_RIDES_PUSH_ENABLED === '1' ? 'true' : 'false',
};

run('bun', ['install'], workspace, env);
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
  const authStorageKey='apois-superapp-motorista-auth-v1';
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
