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
  entregas: '835772994e2c9828dbcef759016c4fad613090e4',
  corridas_passageiro: 'c25dd67464f0913da3dfbe5504ec018d6ff8dfec',
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
const workflows = existsSync(workflowsDir)
  ? readdirSync(workflowsDir).filter((name) => /\.ya?ml$/i.test(name))
  : [];
if (workflows.length) {
  console.error(`[FAIL] GitHub Actions não deve gerar/validar o Superapp; use Codemagic: ${workflows.join(', ')}`);
  failed = true;
} else {
  console.log('[OK] build/validação do Superapp não depende de GitHub Actions; Codemagic é o CI nativo');
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
    'npm run audit:static && npm run verify:pins',
  ],
  'pipeline executa auditoria estática e valida pins antes dos módulos',
);
forbidText(
  'package.json',
  ['normalize-corridas-superapp-input', 'normalize-entregas-superapp-build', 'route-corridas-recovery-deeplink', 'harden-superapp-auth-deeplink-race'],
  'package principal não referencia patchers removidos',
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
    "window.location.replace(shellUrl)",
    "appPlugin.addListener('backButton'",
    "appPlugin.addListener('appStateChange'",
  ],
  'bridge cobre sessão, rotas públicas, retomada, deep links e Android Back',
);

requireText(
  'scripts/harden-entregas-superapp-auth-runtime.mjs',
  [
    'br.com.apois.app://auth/email-change',
    '_app_package: "br.com.apois.app"',
    '<nav className="fixed bottom-0',
    'min-h-[88px]',
    'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
    'overflow-y-auto px-4 pb-32 pt-5',
    'overflow-y-auto p-4 pb-32',
    'overflow-y-auto p-4 pb-32 pt-5',
    'const paymentMethod = "pix";',
  ],
  'Entregas mantém auth/push isolados, rodapé seguro e checkout PIX-only',
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
  'Corridas mantém lifecycle, retomada, push gate e mapa Pix endurecidos',
);

requireText(
  'scripts/inject-superapp-push-routing.mjs',
  [
    'notificationType',
    'const isDeliveryPush',
    'if (!destination) return;',
  ],
  'roteador de Push de Entregas não intercepta Push de Corridas',
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
    'EXPECTED_SIGNING_SHA1: "98:7C:6A:7A:BE:26:9C:1E:5A:01:B5:B7:98:A9:6D:56:66:D8:5E:69"',
    'APOIS_STRICT_NATIVE_CONFIG: "1"',
    'npm run verify:pins',
    'APOIS-Superapp.apk',
  ],
  'Codemagic preserva package, assinatura, pins e nome final esperados',
);

requireText(
  '.env.example',
  ['CORRIDAS_PUBLIC_APP_URL=', 'CORRIDAS_WEB_MAPS_API_KEY=', 'CORRIDAS_ANDROID_MAPS_API_KEY=', 'FIREBASE_SUPERAPP_GOOGLE_SERVICES_JSON_BASE64='],
  'ambiente documenta URL pública, Maps separado e Firebase unificado',
);

process.exit(failed ? 1 : 0);
