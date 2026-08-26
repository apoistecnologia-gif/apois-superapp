import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(path, markers, label) {
  const source = read(path);
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
    return;
  }
  console.log(`[OK] ${label}`);
}

function forbidText(path, markers, label) {
  const source = read(path);
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
    return;
  }
  console.log(`[OK] ${label}`);
}

const lock = JSON.parse(read('.apois/source-lock.json'));
const expectedPins = {
  entregas: '0a1e0b294f75c97bce903200b57e7a6b482f381a',
  corridas_passageiro: 'cc44977db717bdf2d23da455b42135f966d1f427',
  corridas_motorista_admin: 'a74140deff949f1f498b93bedd8fcd1bfc5d8b44',
};
for (const [name, commit] of Object.entries(expectedPins)) {
  if (lock.sources?.[name]?.commit !== commit) {
    console.error(`[FAIL] snapshot protegido ${name} mudou: ${lock.sources?.[name]?.commit ?? 'ausente'}`);
    failed = true;
  } else {
    console.log(`[OK] snapshot protegido ${name}: ${commit}`);
  }
}

const workflowsDir = resolve(root, '.github/workflows');
if (existsSync(workflowsDir) && readdirSync(workflowsDir).some((name) => /\.ya?ml$/i.test(name))) {
  console.error('[FAIL] Superapp voltou a conter GitHub Actions; builds devem ocorrer somente no Codemagic');
  failed = true;
} else {
  console.log('[OK] nenhum GitHub Action ativo no Superapp');
}

const obsoleteFiles = [
  'scripts/normalize-corridas-superapp-input.mjs',
  'scripts/normalize-entregas-superapp-build.mjs',
  'scripts/route-corridas-recovery-deeplink.mjs',
  'scripts/harden-superapp-auth-deeplink-race.mjs',
  'scripts/ensure-superapp-branding-resources.mjs',
];
for (const path of obsoleteFiles) {
  if (existsSync(resolve(root, path))) {
    console.error(`[FAIL] patcher obsoleto voltou ao repositório: ${path}`);
    failed = true;
  }
}
if (!obsoleteFiles.some((path) => existsSync(resolve(root, path)))) {
  console.log('[OK] patchers obsoletos/self-modifying permanecem removidos');
}

requireText(
  'package.json',
  [
    '"audit:static": "node scripts/audit-superapp-static.mjs"',
    'npm run audit:static && npm run',
    'node scripts/verify-final-finance-policy.mjs',
  ],
  'pipeline executa auditoria estática e guarda financeira final antes da liberação',
);
forbidText(
  'package.json',
  ['normalize-corridas-superapp-input', 'normalize-entregas-superapp-build', 'route-corridas-recovery-deeplink', 'harden-superapp-auth-deeplink-race'],
  'package principal não referencia patchers removidos',
);

requireText(
  '.apois/modules.json',
  ['"install": ["bun", "install", "--frozen-lockfile"]'],
  'módulos usam os bun.lock protegidos sem atualizar dependências durante o build',
);

requireText(
  'scripts/bootstrap-sources.sh',
  ['git submodule sync --recursive', 'git submodule update --init --recursive', 'npm run verify:pins'],
  'bootstrap inicializa os mesmos submódulos protegidos usados pelo build',
);
forbidText(
  'scripts/bootstrap-sources.sh',
  ['apps/corridas-passageiro', 'apps/corridas-motorista-admin', 'apps/entregas', 'git clone --depth 1'],
  'bootstrap não cria cópias paralelas nem segue HEAD de branch',
);
requireText(
  'scripts/source-status.sh',
  ['sources/apois-corridas-passageiro', 'sources/apois-corridas-motorista-admin', 'sources/apois-entregas', 'npm run verify:pins'],
  'status das fontes aponta para os snapshots realmente consumidos',
);

requireText(
  'scripts/prepare-workspace.mjs',
  [
    '(method) => method.isActive && method.enabled',
    'paymentMethodsSource.includes(\'method.code === "pix"\')',
    'métodos ativos permanecem disponíveis para a política PIX + Dinheiro + Cartão direto',
  ],
  'Corridas preserva métodos ativos na cópia e rejeita regressão PIX-only',
);
requireText(
  'scripts/harden-corridas-payment-methods.mjs',
  [
    'const isDirectToDriver = code === "cash" || code === "credit";',
    'Pague diretamente ao motorista ao final da corrida.',
    'Pague diretamente ao motorista com cartão de crédito.',
    'PIX permanece digital; Dinheiro e Cartão de crédito ficam disponíveis',
  ],
  'Corridas mantém PIX eletrônico e Dinheiro/Cartão como recebimento direto ao motorista',
);

requireText(
  'scripts/build-isolated-module.mjs',
  [
    "'apois-superapp-corridas-auth-v1'",
    "'apois-superapp-entregas-auth-v1'",
    "'apois-superapp:last-route:' + moduleName",
    "'apois-superapp:corridas-recovery-url'",
    "'apois-superapp:entregas-auth-url'",
    "'/cadastro'",
    "'/recuperar-senha'",
    "new Set(['', '#', '#/', '#/inicio', '#/login'])",
    'localStorage.removeItem(authStorageKey)',
    'env.VITE_PUBLIC_APP_URL = publicAppUrl',
    "window.location.replace(shellUrl)",
    "appPlugin.addListener('backButton'",
    "appPlugin.addListener('appStateChange'",
    "scripts/normalize-entregas-adaptation-handoff.mjs",
  ],
  'bridge cobre sessão íntegra, rotas públicas, retomada, deep links, ambiente, Android Back e handoff determinístico de Entregas',
);

requireText(
  'scripts/normalize-entregas-adaptation-handoff.mjs',
  [
    '? `#/pedido/${encodeURIComponent(orderId)}`',
    '? `/pedido/${encodeURIComponent(orderId)}`',
    'window.location.hash !== target',
    'window.location.pathname !== target',
    'const interimHash =',
    'const originalParams =',
    'handoff entre adaptador base e hardeners especializados concluído',
  ],
  'handoff de Entregas normaliza somente a saída intermediária antes dos hardeners especializados',
);

requireText(
  'scripts/harden-entregas-superapp-auth-runtime.mjs',
  [
    'br.com.apois.app://auth/email-change',
    '_app_package: "br.com.apois.app"',
    'const isDeliveryPush =',
    'if (!target) return;',
    'Sair somente\\n  // de Entregas não pode cancelar a inscrição nativa usada por Corridas',
    '<nav className="fixed bottom-0',
    'min-h-[88px]',
    'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
    'overflow-y-auto px-4 pb-32 pt-5',
    'overflow-y-auto px-4 pb-32 pt-2',
    'overflow-y-auto p-4 pb-32',
    'overflow-y-auto p-4 pb-32 pt-5',
    'const paymentMethod = "pix";',
    'return fallback;',
    'if (!payment?.qrCodeText)',
    'typeof payment.qrCodeImageUrl === "string" ? payment.qrCodeImageUrl : ""',
    'Não foi possível confirmar este acesso. Solicite um novo link ou tente entrar novamente.',
    'toast.error("Não foi possível atualizar sua senha. Tente novamente.")',
  ],
  'Entregas mantém auth/push isolados, token compartilhado, rodapé seguro, checkout PIX resiliente e erros públicos sanitizados',
);

requireText(
  'scripts/harden-entregas-merchant-mercadopago-v2.mjs',
  [
    'merchant-payment-readiness',
    'const pixFunction = "create-merchant-mercadopago-pix";',
    'O PIX da venda é criado diretamente na sua conta Mercado Pago.',
    'A APOIS não recebe o valor da venda e não cobra percentual por pedido.',
  ],
  'Entregas converte o checkout final para Mercado Pago direto do estabelecimento',
);
requireText(
  'scripts/harden-entregas-delivery-readiness.mjs',
  [
    'get_delivery_checkout_readiness',
    'deliveryPlatformAvailable',
    'deliveryUnavailableMessage',
    'checkout desabilita Entrega antes do pedido quando repasse direto do entregador ainda não está homologado',
  ],
  'Entregas bloqueia delivery enquanto payout direto do entregador não estiver homologado',
);
requireText(
  'scripts/verify-final-finance-policy.mjs',
  [
    'Corridas voltou a PIX-only',
    'create-merchant-mercadopago-pix',
    'caminho legado OpenPix/Asaas permaneceu no checkout final',
    'get_delivery_checkout_readiness',
  ],
  'guarda final rejeita regressões financeiras antes da liberação',
);

requireText(
  'scripts/harden-corridas-superapp-runtime.mjs',
  [
    'VITE_APOIS_SUPERAPP_RIDES_PUSH_ENABLED',
    'RIDE_STATUS_ORDER',
    'lastAcceptedStatusRef',
    'await loadRide(currentRideId)',
    'compact?: boolean',
    '<ActiveRideMap ride={ride} compact />',
  ],
  'Corridas mantém lifecycle, retomada, push gate e mapa endurecidos',
);

requireText(
  'scripts/harden-corridas-superapp-push-isolation.mjs',
  [
    'isPushRideEvent',
    'const hasDeliveryMarker =',
    'if (hasDeliveryMarker) return;',
    'if (!isPushRideEvent(data["event"]) && !hasRideId) return;',
  ],
  'listener próprio de Corridas não consome Push de Entregas no package unificado',
);
requireText(
  'scripts/fix-corridas-superapp-ui.mjs',
  ["import './harden-corridas-superapp-push-isolation.mjs';"],
  'isolamento do listener de Corridas é executado antes da compilação do módulo',
);

requireText(
  'scripts/inject-superapp-push-routing.mjs',
  [
    "moduleName: 'entregas'",
    "corridasBase: '../corridas/index.html'",
    'const rideEvents = new Set',
    'if (delivery.isDelivery && ride.isRide) return null;',
    'if (!destination) return;',
  ],
  'roteador global distingue Corridas/Entregas e encaminha notificações entre módulos',
);

requireText(
  'superapp/shell/build.mjs',
  [
    "resolve(root, '../branding/apois-launcher.png')",
    "resolve(dist, 'assets/apois-brand.png')",
    'arte oficial APOIS copiada para o shell',
  ],
  'shell inclui a arte oficial da APOIS e falha se ela estiver ausente',
);

requireText(
  'scripts/install-superapp-launcher.mjs',
  [
    "{ dir: 'mipmap-mdpi', legacy: 48, foreground: 108 }",
    "{ dir: 'mipmap-xxxhdpi', legacy: 192, foreground: 432 }",
    "copyFileSync(legacyTmp, join(dir, 'ic_launcher.png'))",
    "copyFileSync(foregroundTmp, join(dir, 'ic_launcher_foreground.png'))",
  ],
  'launcher gera raster oficial na dimensão Android correta por densidade',
);
forbidText(
  'scripts/install-superapp-launcher.mjs',
  ['copyFileSync(source, source)', 'copyFileSync(normalizedSource, source)'],
  'build Android não altera a arte versionada',
);

requireText(
  'superapp/shell/capacitor.config.ts',
  ["appId: 'br.com.apois.app'", "style: 'LIGHT'", "backgroundColor: '#050505'", "overlaysWebView: false"],
  'Capacitor usa package unificado e barras Android legíveis',
);

requireText(
  'codemagic.yaml',
  [
    'android-superapp-experimental:',
    'APP_PACKAGE: "br.com.apois.app"',
    'BUN_VERSION: "1.3.14"',
    'bash -s "bun-v${BUN_VERSION}"',
    'test "$(bun --version)" = "$BUN_VERSION"',
    'EXPECTED_SIGNING_SHA1: "98:7C:6A:7A:BE:26:9C:1E:5A:01:B5:B7:98:A9:6D:56:66:D8:5E:69"',
    'APOIS_STRICT_NATIVE_CONFIG: "1"',
    'npm run verify:pins',
    'APOIS-Superapp.apk',
  ],
  'Codemagic preserva toolchain, package, assinatura, pins e nome final esperados',
);
forbidText(
  'codemagic.yaml',
  ['cmp -s superapp/branding/apois-launcher.png superapp/shell/android'],
  'Codemagic não pressupõe que PNG redimensionado seja byte-idêntico à arte fonte',
);

requireText(
  '.env.example',
  ['CORRIDAS_PUBLIC_APP_URL=', 'CORRIDAS_WEB_MAPS_API_KEY=', 'CORRIDAS_ANDROID_MAPS_API_KEY=', 'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64='],
  'ambiente documenta URL pública, Maps separado e Firebase unificado',
);

process.exit(failed ? 1 : 0);
