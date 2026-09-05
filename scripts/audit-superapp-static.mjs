import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;

function read(path) { return readFileSync(resolve(root, path), 'utf8'); }
function requireText(path, markers, label) {
  const source = read(path);
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) { console.error(`[FAIL] ${label}: ${missing.join(' | ')}`); failed = true; }
  else console.log(`[OK] ${label}`);
}
function forbidText(path, markers, label) {
  const source = read(path);
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) { console.error(`[FAIL] ${label}: ${found.join(' | ')}`); failed = true; }
  else console.log(`[OK] ${label}`);
}

const expectedPins = {
  entregas: '0a1e0b294f75c97bce903200b57e7a6b482f381a',
  corridas_passageiro: '7b047f75a1a919a5336c0df6e0d60b14b02f2618',
  corridas_motorista_admin: '9fc171050d8b5703540c49d19a8f1e9f5162775f',
};
const lock = JSON.parse(read('.apois/source-lock.json'));
for (const [name, commit] of Object.entries(expectedPins)) {
  const actual = lock.sources?.[name]?.commit;
  if (actual !== commit) { console.error(`[FAIL] snapshot protegido ${name}: ${actual ?? 'ausente'} != ${commit}`); failed = true; }
  else console.log(`[OK] snapshot protegido ${name}: ${commit}`);
}

const workflowsDir = resolve(root, '.github/workflows');
if (existsSync(workflowsDir) && readdirSync(workflowsDir).some((name) => /\.ya?ml$/i.test(name))) {
  console.error('[FAIL] Superapp voltou a conter GitHub Actions; release continua no Codemagic');
  failed = true;
} else console.log('[OK] nenhum GitHub Action ativo no Superapp');

requireText(
  'package.json',
  [
    '"audit:static": "node scripts/audit-superapp-static.mjs"',
    '"build:corridas": "node scripts/build-isolated-module.mjs corridas"',
    '"build:entregas": "node scripts/build-isolated-module.mjs entregas"',
    '"build:shell": "node scripts/harden-superapp-shell-auth-deeplink-source.mjs && node superapp/shell/build.mjs"',
    'node scripts/verify-final-finance-policy.mjs',
  ],
  'pipeline principal mantém auditoria, módulos, shell e guarda financeira',
);

requireText(
  '.apois/modules.json',
  [
    '"source": "sources/apois-corridas-passageiro"',
    '"workspace": ".work/corridas"',
    'harden-corridas-cancellation-policy.mjs',
    'harden-corridas-superapp-storage.mjs',
    'harden-superapp-module-mobile-ui.mjs corridas',
    'APOIS_VISUAL_KIT_V1',
    'bun run build:capacitor',
  ],
  'Corridas é reconstruído do snapshot protegido e recebe hardeners atuais antes do build',
);
forbidText(
  '.apois/modules.json',
  ['ActiveRideMap.tsx', 'RidePixPaymentCard.tsx', 'ActiveJourneyScreen.tsx', 'aguardando_pagamento: 2'],
  'pipeline Corridas não exige componentes ou estados ausentes no pin atual',
);

requireText(
  'scripts/prepare-workspace.mjs',
  [
    'rmSync(workspace, { recursive: true, force: true })',
    'cpSync(source, workspace',
    'request-ride',
    'métodos ativos permanecem disponíveis para a política PIX + Dinheiro + Cartão direto',
  ],
  'workspace é descartável, reconstruído do pin e encaminha solicitação pelo roteador financeiro',
);

requireText(
  'scripts/build-isolated-module.mjs',
  [
    'scripts/prepare-workspace.mjs',
    'scripts/adapt-module-for-superapp.mjs',
    'scripts/harden-corridas-superapp-runtime.mjs',
    'scripts/fix-corridas-superapp-ui.mjs',
    'scripts/harden-corridas-payment-methods.mjs',
    "'apois-superapp-corridas-auth-v1'",
    "'apois-superapp-entregas-auth-v1'",
    "appPlugin.addListener('backButton'",
    "appPlugin.addListener('appStateChange'",
  ],
  'build isolado prepara, adapta e integra sessão/back button sem editar submódulo',
);

requireText(
  'scripts/harden-corridas-superapp-runtime.mjs',
  [
    'VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED',
    'RIDE_STATUS_ORDER',
    'lastAcceptedStatusRef',
    'await loadRide(currentRideId)',
    'PassengerMap',
  ],
  'runtime Corridas usa lifecycle atual, recuperação e mapa do pin real',
);
forbidText(
  'scripts/harden-corridas-superapp-runtime.mjs',
  ['ActiveRideMap.tsx', 'RidePixPaymentCard.tsx', 'aguardando_pagamento'],
  'runtime Corridas não ressuscita componentes/estados obsoletos',
);

requireText(
  'scripts/fix-corridas-superapp-ui.mjs',
  [
    "import './harden-corridas-superapp-push-isolation.mjs';",
    'src/components/BottomNavigation.tsx',
    'src/routes/_authenticated.perfil.tsx',
    'src/routes/_authenticated.tsx',
    'hideBottomNavigation',
  ],
  'UI Corridas adapta navegação e perfil que realmente existem',
);
forbidText(
  'scripts/fix-corridas-superapp-ui.mjs',
  ['src/components/layout/AppShell.tsx', 'PassengerProfileCenter.tsx', 'native-password-recovery.ts', 'categoryArtwork'],
  'UI Corridas não depende de arquivos de revisão antiga',
);

requireText(
  'scripts/harden-corridas-kit-visual.mjs',
  [
    'APOIS_VISUAL_KIT_V1',
    'apois-kit-home-panel',
    '<HomeWorkShortcuts />',
    'apois-kit-search-results',
    'max-h-[94dvh]',
    'grid-cols-[58px_minmax(0,1fr)_auto]',
  ],
  'kit visual oficial atua na Home, busca, BottomSheet e categorias do pin atual',
);
requireText(
  'scripts/harden-corridas-superapp-profile-ui.mjs',
  ['src/routes/_authenticated.perfil.tsx', "await import('./harden-corridas-kit-visual.mjs')"],
  'kit visual é a última etapa do hardening mobile de Corridas',
);

requireText(
  'scripts/harden-corridas-payment-methods.mjs',
  [
    'const isDirectToDriver = code === "cash" || code === "credit";',
    'Pague diretamente ao motorista ao final da corrida.',
    'Pague diretamente ao motorista com cartão de crédito.',
  ],
  'Corridas mantém PIX eletrônico e Dinheiro/Cartão direto ao motorista',
);
requireText(
  'scripts/harden-corridas-cancellation-policy.mjs',
  [
    'canCancel: ["procurar_motorista", "motorista_a_caminho", "motorista_chegou"].includes(status)',
    'em_viagem não pode permitir cancelamento',
  ],
  'cancelamento Corridas é bloqueado depois do início da viagem',
);

requireText(
  'scripts/harden-corridas-superapp-push-isolation.mjs',
  ['isPushRideEvent', 'const hasDeliveryMarker =', 'if (hasDeliveryMarker) return;'],
  'listener Corridas ignora Push de Entregas no package unificado',
);
requireText(
  'scripts/inject-superapp-push-routing.mjs',
  ["moduleName: 'entregas'", "corridasBase: '../corridas/index.html'", 'const rideEvents = new Set', 'if (!destination) return;'],
  'roteador global encaminha Push ao módulo correto',
);

requireText(
  'scripts/harden-entregas-superapp-auth-runtime.mjs',
  [
    'br.com.apois.app://auth/email-change',
    '_app_package: "br.com.apois.app"',
    'const isDeliveryPush =',
    'const paymentMethod = "pix";',
  ],
  'Entregas mantém auth/push isolados e checkout PIX',
);
requireText(
  'scripts/verify-final-finance-policy.mjs',
  ['Corridas voltou a PIX-only', 'create-merchant-mercadopago-pix', 'get_delivery_checkout_readiness'],
  'guarda financeira continua rejeitando regressões conhecidas',
);

requireText(
  'superapp/shell/build.mjs',
  ["resolve(root, '../branding/apois-launcher.png')", "resolve(dist, 'assets/apois-brand.png')"],
  'shell empacota marca oficial',
);
requireText(
  'superapp/shell/capacitor.config.ts',
  ["appId: 'br.com.apois.app'", "backgroundColor: '#050505'", 'overlaysWebView: false'],
  'Capacitor usa package unificado e fundo de lançamento correto',
);
requireText(
  'codemagic.yaml',
  ['android-superapp-experimental:', 'APP_PACKAGE: "br.com.apois.app"', 'npm run verify:pins', 'APOIS-Superapp.apk'],
  'Codemagic mantém package, pins e artefato Cliente',
);
requireText(
  '.env.example',
  ['CORRIDAS_PUBLIC_APP_URL=', 'CORRIDAS_WEB_MAPS_API_KEY=', 'CORRIDAS_ANDROID_MAPS_API_KEY=', 'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64='],
  'ambiente documenta URL pública, Maps e Firebase unificado',
);

process.exit(failed ? 1 : 0);
