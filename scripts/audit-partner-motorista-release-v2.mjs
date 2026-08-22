import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;

function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Motorista release v2: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}

function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}

function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else {
    console.log(`[OK] ${label}`);
  }
}

requireAll('scripts/harden-partner-motorista-payment-policy.mjs', [
  "import './harden-partner-motorista-direct-earnings.mjs';",
  "import './harden-partner-motorista-release-surface.mjs';",
  "import './harden-partner-motorista-native-utilities.mjs';",
  "import './harden-partner-motorista-session-hygiene.mjs';",
  "import './harden-partner-motorista-navigation.mjs';",
  "import './harden-partner-motorista-legal-navigation.mjs';",
  "import './harden-partner-motorista-settings-cleanup.mjs';",
], 'pipeline financeiro do Motorista carrega todas as proteções de release');

requireAll('scripts/harden-partner-motorista-release-surface.mjs', [
  'requestDriverWithdrawal(_amountCents: number)',
  'Saque manual não está disponível no APOIS Parceiro',
  "next.includes('request-driver-payout')",
  'Avisos sobre mensalidade, pagamentos e registros dos seus recebimentos.',
  'ganhos registrados, pagamentos, liquidações',
  'A APOIS não utiliza uma carteira custodial',
  'A APOIS não retém comissão por corrida',
  'dinheiro e cartão',
  'Entre na sua conta para enviar uma solicitação de suporte.',
  '100% do valor da corrida para o motorista',
], 'release do Motorista neutraliza saque, corrige finanças, legal, suporte e mensalidade');

requireAll('scripts/harden-partner-motorista-native-utilities.mjs', [
  'Capacitor.isNativePlatform()',
  'Geolocation.checkPermissions()',
  'Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] })',
  'Geolocation.getCurrentPosition({',
  'getPartnerCurrentPosition(5000)',
  'getPartnerCurrentPosition(8000)',
  "patch('src/routes/motorista.configuracoes.tsx'",
], 'SOS, compartilhamento e diagnóstico de localização usam GPS nativo Android');

requireAll('scripts/harden-partner-motorista-session-hygiene.mjs', [
  "patch('src/components/MovviHeader.tsx'",
  'await unregisterCurrentDevice();',
  'window.location.replace("../../index.html")',
  'Sessão do Motorista encerrada.',
  "patch('src/routes/motorista.configuracoes.tsx'",
], 'logout do Motorista limpa registro Push do módulo e retorna ao seletor Parceiro');

requireAll('scripts/harden-partner-motorista-navigation.mjs', [
  'to: "/motorista/ganhos", label: "Ganhos"',
  'Recebimentos das corridas',
  "next.includes('to: \"/motorista/carteira\"')",
  'min-h-[82px]',
  'min-h-[60px]',
  'h-6 w-6',
  'text-xs font-extrabold',
  'paddingBottom: "max(env(safe-area-inset-bottom), 10px)"',
], 'navegação do Motorista aponta para Ganhos, elimina carteira duplicada e usa alvos confortáveis no celular');

requireAll('scripts/harden-partner-motorista-legal-navigation.mjs', [
  'Capacitor.isNativePlatform()',
  'await Browser.open({ url });',
  'setChecking(false)',
], 'termos públicos abrem fora do WebView do módulo e preservam retorno ao APOIS Parceiro');

requireAll('scripts/harden-partner-motorista-settings-cleanup.mjs', [
  'title="Segurança e emergência"',
  'SOS e contatos de emergência',
  'Sair de todos os dispositivos',
  'Sessões ativas em breve.',
  'Biometria em breve.',
  'PIN em breve.',
  'aria-label="Idioma preferido"',
  'const protectedOperationalKeys = new Set([',
  '"apois:driver:online"',
  '"apois-parceiro:operational-role"',
  '!protectedOperationalKeys.has(key)',
], 'configurações removem atalhos incompletos e limpar cache não apaga presença/trava operacional');

const routeTreePath = 'sources/apois-corridas-motorista-admin/src/mobile-route-tree.motorista.ts';
requireAll(routeTreePath, [
  "./routes/motorista.app",
  "./routes/motorista.assinatura",
  "./routes/motorista.configuracoes",
  "./routes/motorista.seguranca",
  "./routes/motorista.suporte",
  "./routes/motorista.termos",
], 'árvore mobile do Motorista contém somente superfícies esperadas da operação');
forbidAll(routeTreePath, [
  "from './routes/debug",
  "from './routes/dev.",
  "from './routes/admin",
  "from './routes/passageiro",
  "from './routes/diagnostico",
  "from './routes/map-test",
], 'bundle mobile do Motorista exclui rotas de debug, admin, passageiro e diagnóstico');

forbidAll('scripts/harden-partner-motorista-session-hygiene.mjs', [
  'PushNotifications.unregister()',
], 'higiene de sessão não invalida o token FCM nativo compartilhado');

process.exit(failed ? 1 : 0);
