import '../../scripts/harden-partner-shell-startup.mjs';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const branding = resolve(root, '../branding/apois-launcher.png');
const driverLogoSource = resolve(root, '../../.work/partner-motorista/src/assets/apoisLogoData.ts');

function readTextTree(directory) {
  let output = '';
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      output += readTextTree(path);
      continue;
    }
    if (!/\.(?:html|js|css|json|txt)$/i.test(entry)) continue;
    try { output += `\n${readFileSync(path, 'utf8')}`; } catch { /* ignora binários inesperados */ }
  }
  return output;
}

function requireMarker(source, marker, label) {
  if (!source.includes(marker)) {
    console.error(`[FAIL] bundle Parceiro: ${label} — ausente: ${marker}`);
    process.exit(1);
  }
  console.log(`[OK] bundle Parceiro: ${label}`);
}

function forbidMarker(source, marker, label) {
  if (source.includes(marker)) {
    console.error(`[FAIL] bundle Parceiro: ${label} — encontrado: ${marker}`);
    process.exit(1);
  }
  console.log(`[OK] bundle Parceiro: ${label}`);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

if (!existsSync(branding)) {
  console.error(`[FAIL] branding APOIS ausente em ${branding}`);
  process.exit(1);
}

let brandDataUrl = `data:image/png;base64,${readFileSync(branding).toString('base64')}`;
if (existsSync(driverLogoSource)) {
  const logoModule = readFileSync(driverLogoSource, 'utf8');
  const match = logoModule.match(/APOIS_LOGO_DATA_URL\s*=\s*["']([^"']+)["']/);
  if (match?.[1]?.startsWith('data:image/')) {
    brandDataUrl = match[1];
    console.log('[OK] seletor parceiro reutiliza a mesma logomarca oficial exibida no login do Motorista');
  } else {
    console.warn('[WARN] data URL da logomarca do Motorista não encontrada; usando launcher oficial como fallback');
  }
}

const templatePath = resolve(root, 'index.html');
let shellHtml = readFileSync(templatePath, 'utf8');
if (!shellHtml.includes('__APOIS_BRAND_DATA_URL__')) {
  console.error('[FAIL] placeholder da logo APOIS não encontrado no shell parceiro');
  process.exit(1);
}
shellHtml = shellHtml.replace('__APOIS_BRAND_DATA_URL__', brandDataUrl);
writeFileSync(resolve(dist, 'index.html'), shellHtml, 'utf8');

mkdirSync(resolve(dist, 'assets'), { recursive: true });
cpSync(branding, resolve(dist, 'assets/apois-brand.png'));

const modules = [
  ['motorista', resolve(root, '../../.work/partner-motorista/dist/client')],
  ['entregador', resolve(root, '../../.work/partner-entregador/.output/public')],
];

for (const [name, source] of modules) {
  if (!existsSync(source)) {
    console.error(`[FAIL] bundle parceiro ${name} ausente em ${source}`);
    process.exit(1);
  }
  const target = resolve(dist, 'modules', name);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`[OK] ${name} copiado para o APOIS Parceiro`);
}

const driverBundle = readTextTree(resolve(dist, 'modules/motorista'));
requireMarker(driverBundle, 'Ganhos', 'Motorista exibe área de Ganhos');
requireMarker(driverBundle, 'Recebimento direto ao motorista', 'Motorista explica recebimento direto');
requireMarker(driverBundle, '100% do valor da corrida', 'Motorista preserva valor integral da corrida');
requireMarker(driverBundle, 'Status do cadastro', 'Motorista mantém acesso ao status pelo Perfil');
requireMarker(driverBundle, 'Veículo e documentos', 'Motorista mantém documentos em um único atalho');
requireMarker(driverBundle, 'backButton', 'Motorista leva proteção do botão Voltar para o bundle final');
requireMarker(driverBundle, 'Fique offline ou use Trocar perfil de parceiro', 'Motorista não permite sair do módulo enquanto permanece ONLINE');
requireMarker(driverBundle, 'Fique offline no mapa antes de sair, trocar de conta ou excluir seu cadastro.', 'Motorista bloqueia saídas secundárias enquanto a função permanece operacional');
requireMarker(driverBundle, 'background_location_unavailable', 'Motorista leva fail-safe do Foreground Service ao bundle final');
requireMarker(driverBundle, 'Modo online desativado porque a localização em segundo plano não iniciou', 'Motorista informa falha de background e volta para OFFLINE');
requireMarker(driverBundle, 'TOKEN_REFRESHED', 'Motorista repassa renovação de sessão WebView ao GPS nativo');
requireMarker(driverBundle, 'updateSession', 'Motorista leva atualização da sessão nativa ao bundle final');
requireMarker(driverBundle, 'apois-parceiro:operational-role', 'Motorista grava trava operacional do shell');
forbidMarker(driverBundle, 'Solicitar saque', 'Motorista não leva CTA de saque legado ao APK');
forbidMarker(driverBundle, 'Carteira e corridas', 'Motorista não leva nomenclatura custodial antiga ao APK');
forbidMarker(driverBundle, 'Carteira — APOIS Motorista', 'Motorista não leva a rota da carteira custodial antiga');
forbidMarker(driverBundle, 'Chat em breve', 'Motorista não exibe ação de chat sem implementação');
forbidMarker(driverBundle, 'Abrir menu', 'Motorista não recompila menu lateral duplicado na tela principal');
forbidMarker(driverBundle, 'apois:splash:motorista', 'Motorista não mostra splash interna depois do seletor Parceiro');
forbidMarker(driverBundle, 'Esta é uma versão preliminar', 'Motorista não publica termos marcados como preliminares');

const courierBundle = readTextTree(resolve(dist, 'modules/entregador'));
requireMarker(courierBundle, 'Entregas', 'Entregador usa nomenclatura correta de Entregas');
requireMarker(courierBundle, 'Perfil indisponível durante a entrega', 'Entregador mantém foco na operação durante entrega ativa');
requireMarker(courierBundle, 'CourierLocation', 'Entregador leva ponte para Foreground Service nativo ao bundle final');
requireMarker(courierBundle, 'Não foi possível ativar a localização em segundo plano', 'Entregador falha fechado se o serviço de background não iniciar');
requireMarker(courierBundle, 'não foi possível confirmar que você ficou offline', 'Entregador preserva trava se rollback OFFLINE falhar');
requireMarker(courierBundle, 'backButton', 'Entregador leva proteção do botão Voltar para o bundle final');
requireMarker(courierBundle, 'Fique offline ou use Trocar perfil de parceiro', 'Entregador não permite sair do módulo enquanto permanece ONLINE');
requireMarker(courierBundle, 'TOKEN_REFRESHED', 'Entregador repassa renovação de sessão WebView ao GPS nativo');
requireMarker(courierBundle, 'updateSession', 'Entregador leva atualização da sessão nativa ao bundle final');
requireMarker(courierBundle, 'apois-parceiro:operational-role', 'Entregador grava trava operacional do shell');
forbidMarker(courierBundle, 'Solicitar saque', 'Entregador não leva CTA de saque legado ao APK');
forbidMarker(courierBundle, 'Carteira e saques', 'Entregador não leva nomenclatura financeira antiga ao APK');

const finalShell = readFileSync(resolve(dist, 'index.html'), 'utf8');
requireMarker(finalShell, 'APOIS Parceiro', 'shell final mantém identidade Parceiro');
requireMarker(finalShell, "/modules/motorista/index.html", 'shell ancora Motorista na raiz do WebView');
requireMarker(finalShell, "/modules/entregador/index.html", 'shell ancora Entregador na raiz do WebView');
requireMarker(finalShell, 'apois-parceiro:pending-push', 'shell final preserva roteamento de Push cruzado');
requireMarker(finalShell, 'apois-parceiro:operational-role', 'shell final mantém trava de função operacional');
requireMarker(finalShell, 'function routeRole(requestedRole,target)', 'shell final protege seletor, push e deep link contra troca de função ativa');
requireMarker(finalShell, 'async function bootPartnerShell()', 'shell final usa bootstrap assíncrono para callbacks nativos');
requireMarker(finalShell, 'const launch=await appPlugin.getLaunchUrl();', 'shell final consulta deep link de lançamento antes do redirect operacional');
requireMarker(finalShell, 'if(launch?.url&&relayDeepLink(launch.url))return;', 'shell final consome callback de lançamento antes da trava local');
requireMarker(finalShell, 'if(consumePendingPartnerPush())return;', 'shell final consome Push pendente antes da trava para não deixá-lo reaparecer depois');
requireMarker(finalShell, 'const lockedOnLaunch=operationalRole();', 'relançar o app sem callback/push volta à função operacional ativa');
const launchIndex = finalShell.indexOf('const launch=await appPlugin.getLaunchUrl();');
const pendingIndex = finalShell.indexOf('if(consumePendingPartnerPush())return;');
const lockIndex = finalShell.indexOf('const lockedOnLaunch=operationalRole();');
if (!(launchIndex >= 0 && pendingIndex > launchIndex && lockIndex > pendingIndex)) {
  console.error('[FAIL] bundle Parceiro: ordem de bootstrap deve ser deep link -> Push pendente -> trava operacional');
  process.exit(1);
}

console.log('[OK] APOIS Parceiro gerado e validado: finanças, UI operacional, GPS/background, sessão WebView/FGS, callbacks/Push, saídas secundárias, back guards e trava cruzada protegidos.');
