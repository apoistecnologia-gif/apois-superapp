import { protectEmbeddedViewport } from '../../scripts/protect-apois-embedded-viewport-v1.mjs';
import '../../scripts/harden-partner-shell-startup.mjs';
import { verifyPartnerBundleAssets } from '../../scripts/qa/verify-partner-static-assets-v1.mjs';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const branding = resolve(root, '../branding/apois-client-red-logo.b64');

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

function sanitizeLegacyBrandInDist(directory) {
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      sanitizeLegacyBrandInDist(path);
      continue;
    }
    if (!/\.(?:html|js|css|json|txt)$/i.test(entry)) continue;
    let source;
    try { source = readFileSync(path, 'utf8'); } catch { continue; }
    const next = source
      .replaceAll('#F6BE1C', '#E51B23')
      .replaceAll('#f6be1c', '#E51B23')
      .replaceAll('#C88A08', '#C9141B')
      .replaceAll('#c88a08', '#C9141B')
      .replaceAll('rgba(246,190,28', 'rgba(229,27,35')
      .replaceAll('rgba(200,138,8', 'rgba(201,20,27');
    if (next !== source) writeFileSync(path, next, 'utf8');
  }
}

function localizeCourierDecorativeAsset(directory) {
  for (const entry of readdirSync(directory)) {
    const file = resolve(directory, entry);
    if (statSync(file).isDirectory()) { localizeCourierDecorativeAsset(file); continue; }
    if (!/\.(html|js|mjs|css|json)$/.test(entry)) continue;
    const source = readFileSync(file, 'utf8');
    // Replace only the unavailable decorative image; Vite base owns chunk URLs.
    const next = source
      .replace(/\/__l5e\/assets-v1\/[a-zA-Z0-9-]+\/delivery-hero\.png/g,
        'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%221%22 height=%221%22/%3E');
    if (next !== source) writeFileSync(file, next, 'utf8');
  }
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
  console.error(`[FAIL] branding APOIS vermelho ausente em ${branding}`);
  process.exit(1);
}
const brandBase64 = readFileSync(branding, 'utf8').trim();
const brandBytes = Buffer.from(brandBase64, 'base64');
if (brandBytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
  console.error('[FAIL] branding APOIS vermelho do Parceiro não é um PNG válido');
  process.exit(1);
}
let brandDataUrl = `data:image/png;base64,${brandBase64}`;
console.log('[OK] seletor parceiro usa a logomarca oficial vermelha da nova identidade');

const templatePath = resolve(root, 'index.html');
let shellHtml = readFileSync(templatePath, 'utf8');
if (!shellHtml.includes('__APOIS_BRAND_DATA_URL__')) {
  console.error('[FAIL] placeholder da logo APOIS não encontrado no shell parceiro');
  process.exit(1);
}
shellHtml = shellHtml.replace('__APOIS_BRAND_DATA_URL__', brandDataUrl);
writeFileSync(resolve(dist, 'index.html'), shellHtml, 'utf8');

mkdirSync(resolve(dist, 'assets'), { recursive: true });
writeFileSync(resolve(dist, 'assets/apois-brand.png'), brandBytes);

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
  sanitizeLegacyBrandInDist(target);
  if (name === 'entregador') {
    localizeCourierDecorativeAsset(target);
    // Same SSR asset normalization as the Cliente shell: TanStack manifests
    // can emit /./assets even after the initial HTML attribute rewrite.
    const entry = resolve(target, 'index.html');
    const html = readFileSync(entry, 'utf8');
    writeFileSync(entry, html.replaceAll('/./assets/', './assets/').replaceAll('../assets/', './assets/'), 'utf8');
  }
  console.log(`[OK] ${name} copiado para o APOIS Parceiro e saneado contra tokens visuais legados`);
}

const driverBundle = readTextTree(resolve(dist, 'modules/motorista'));
if (!driverBundle.toLowerCase().includes('#e51b23')) {
  console.error('[FAIL] bundle Parceiro: Motorista não leva vermelho APOIS ao bundle final');
  process.exit(1);
}
if (driverBundle.toLowerCase().includes('#f6be1c') || driverBundle.toLowerCase().includes('#c88a08')) {
  console.error('[FAIL] bundle Parceiro: Motorista ainda contém dourado antigo da identidade anterior');
  process.exit(1);
}
console.log('[OK] bundle Parceiro: Motorista usa identidade vermelho/branco sem dourado antigo');
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
requireMarker(driverBundle, 'Abrir menu lateral', 'Motorista disponibiliza o menu lateral solicitado com navegação preservada');
forbidMarker(driverBundle, 'apois:splash:motorista', 'Motorista não mostra splash interna depois do seletor Parceiro');
forbidMarker(driverBundle, 'Esta é uma versão preliminar', 'Motorista não publica termos marcados como preliminares');

const courierBundle = readTextTree(resolve(dist, 'modules/entregador'));
if (!courierBundle.toLowerCase().includes('#e51b23')) {
  console.error('[FAIL] bundle Parceiro: Entregador não leva vermelho APOIS ao bundle final');
  process.exit(1);
}
if (courierBundle.toLowerCase().includes('#f6be1c') || courierBundle.toLowerCase().includes('#c88a08')) {
  console.error('[FAIL] bundle Parceiro: Entregador ainda contém dourado antigo da identidade anterior');
  process.exit(1);
}
console.log('[OK] bundle Parceiro: Entregador usa identidade vermelho/branco sem dourado antigo');
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

protectEmbeddedViewport(dist, ['motorista','entregador']);
verifyPartnerBundleAssets(dist);
console.log('[OK] APOIS Parceiro gerado e validado: finanças, UI operacional, GPS/background, sessão WebView/FGS, callbacks/Push, saídas secundárias, back guards e trava cruzada protegidos.');
