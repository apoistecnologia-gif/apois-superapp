import '../../scripts/harden-superapp-shell-auth.mjs';
import '../../scripts/harden-superapp-shell-mobile-ui.mjs';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const officialBranding = resolve(root, '../branding/apois-client-red-logo.b64');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(resolve(root, 'index.html'), resolve(dist, 'index.html'));

if (!existsSync(officialBranding)) {
  console.error(`[FAIL] arte oficial APOIS não existe em ${officialBranding}`);
  process.exit(1);
}
const officialBrandingBytes = Buffer.from(readFileSync(officialBranding, 'utf8').trim(), 'base64');
const pngSignature = officialBrandingBytes.subarray(0, 8).toString('hex');
const pngWidth = officialBrandingBytes.length >= 24 ? officialBrandingBytes.readUInt32BE(16) : 0;
const pngHeight = officialBrandingBytes.length >= 24 ? officialBrandingBytes.readUInt32BE(20) : 0;
if (pngSignature !== '89504e470d0a1a0a' || officialBrandingBytes.length < 4096 || pngWidth !== 128 || pngHeight !== 128) {
  console.error('[FAIL] arte oficial APOIS em base64 não decodifica para um PNG válido');
  process.exit(1);
}
mkdirSync(resolve(dist, 'assets'), { recursive: true });
writeFileSync(resolve(dist, 'assets/apois-brand.png'), officialBrandingBytes);

// O shell é a primeira tela exibida pelo WebView. Além do arquivo físico,
// embuta a mesma arte no HTML para que a marca não dependa de resolução de
// caminho/asset no Capacitor e nunca resulte em um cabeçalho vazio.
const shellIndexPath = resolve(dist, 'index.html');
let shellHtml = readFileSync(shellIndexPath, 'utf8');
const brandDataUri = `data:image/png;base64,${officialBrandingBytes.toString('base64')}`;
if (!shellHtml.includes('./assets/apois-brand.png')) {
  console.error('[FAIL] shell cliente perdeu o marcador da logomarca APOIS');
  process.exit(1);
}
shellHtml = shellHtml.replace('./assets/apois-brand.png', brandDataUri);
writeFileSync(shellIndexPath, shellHtml, 'utf8');
if (!readFileSync(shellIndexPath, 'utf8').includes('data:image/png;base64,')) {
  console.error('[FAIL] logomarca APOIS não foi embutida no shell final');
  process.exit(1);
}
console.log(`[OK] arte oficial APOIS decodificada e embutida no shell cliente (${pngWidth}x${pngHeight})`);

// Arquitetura oficial: este APK é exclusivamente do cliente.
// Motorista e Entregador pertencem ao Superapp Parceiro e não entram aqui.
const modules = [
  ['corridas', resolve(root, '../../.work/corridas/dist')],
  ['entregas', resolve(root, '../../.work/entregas/.output/public')],
];

for (const [name, source] of modules) {
  if (!existsSync(source)) {
    console.error(`[FAIL] bundle obrigatório ${name} não existe em ${source}`);
    process.exit(1);
  }
  const target = resolve(dist, 'modules', name);
  mkdirSync(target, { recursive: true });
  cpSync(source, target, { recursive: true });
  console.log(`[OK] ${name} copiado para dist/modules/${name}`);
}

// APOIS_SWITCHER_SAFE_CORNER_V1: the floating service control must stay above page headers,
// not over login/recovery headlines or form hints. Normal stacking also yields to native dialogs.
// Ponte visual do Superapp: permite trocar Corridas <-> Entregas sem encerrar
// nenhuma sessão. Cada módulo já persiste sua própria sessão em chaves separadas.
// O botão apenas volta ao seletor principal; não chama signOut().
const moduleBridgeScript = `
<script id="apois-superapp-module-bridge">
(function () {
  function goToSelector() {
    // Os módulos vivem em dist/modules/<nome>/index.html. Usar "/" aqui é
    // perigoso dentro do WebView Capacitor porque pode resolver para a raiz do
    // origin interno em vez do shell empacotado. Volte explicitamente dois
    // níveis para o index do Superapp.
    window.location.replace('../../index.html');
  }

  function mountSwitcher() {
    if (document.getElementById('apois-switch-service')) return;
    var button = document.createElement('button');
    button.id = 'apois-switch-service';
    button.type = 'button';
    button.setAttribute('aria-label', 'Trocar entre Corridas e Entregas');
    button.setAttribute('title', 'Trocar serviço');
    button.innerHTML = '<span aria-hidden="true">⇄</span>';
    button.style.position = 'fixed';
    button.style.right = 'max(12px, env(safe-area-inset-right))';
    button.style.top = 'calc(max(env(safe-area-inset-top), 12px) + 8px)';
    button.style.zIndex = '40';
    button.style.width = '44px';
    button.style.height = '44px';
    button.style.borderRadius = '14px';
    button.style.border = '1px solid rgba(229,27,35,.20)';
    button.style.background = 'rgba(255,255,255,.96)';
    button.style.color = '#E51B23';
    button.style.fontSize = '24px';
    button.style.fontWeight = '900';
    button.style.boxShadow = '0 8px 24px rgba(17,17,17,.14)';
    button.style.backdropFilter = 'blur(10px)';
    button.style.webkitBackdropFilter = 'blur(10px)';
    button.style.display = 'grid';
    button.style.placeItems = 'center';
    button.style.padding = '0';
    button.addEventListener('click', goToSelector);
    document.body.appendChild(button);
  }

  // APOIS_SWITCHER_OVERLAY_COURTESY_V1: alerts and modal dialogs must take priority.
  // MutationObserver is already present; no second listener or timer is added.
  function syncSwitcherVisibility() {
    var button = document.getElementById('apois-switch-service');
    if (!button) return;
    var activeOverlay = document.querySelector('[data-sonner-toast], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
    var hide = !!activeOverlay;
    var desired = hide ? 'hidden' : 'visible';
    if (button.style.visibility !== desired) button.style.visibility = desired;
    button.style.pointerEvents = hide ? 'none' : 'auto';
  }

  // APOIS_CORRIDAS_RECOVERY_BACK_HITAREA_V3: the back link was a stretched
  // flex item covering the switcher's top-right tap area on 320–390px.
  function keepRecoveryBackLinkCompact() {
    if (!/recuperar-senha/.test(window.location.hash || '')) return;
    var links = document.querySelectorAll('a');
    Array.prototype.forEach.call(links, function (link) {
      if (!/^Voltar para o login/i.test((link.textContent || '').trim())) return;
      link.style.setProperty('width', 'fit-content', 'important');
      link.style.setProperty('align-self', 'flex-start', 'important');
    });
  }

  // Corridas: se a foto externa do Google falhar, nunca mostrar o texto quebrado
  // "Foto". Trocamos por uma inicial legível do passageiro.
  function repairBrokenPassengerAvatar(root) {
    var scope = root && root.querySelectorAll ? root : document;
    var images = scope.querySelectorAll ? scope.querySelectorAll('img[alt="Foto do passageiro"]') : [];
    Array.prototype.forEach.call(images, function (img) {
      if (img.dataset.apoisAvatarGuard === '1') return;
      img.dataset.apoisAvatarGuard = '1';
      function fallback() {
        var holder = img.parentElement;
        if (!holder) return;
        var greeting = document.body.innerText.match(/(?:Bom dia|Boa tarde|Boa noite|Boa madrugada),\\s*([^\\s👋]+)/i);
        var initial = greeting && greeting[1] ? greeting[1].charAt(0).toUpperCase() : 'P';
        holder.textContent = initial;
      }
      img.addEventListener('error', fallback, { once: true });
      if (img.complete && img.naturalWidth === 0) fallback();
    });
  }

  function initialize() {
    mountSwitcher();
    syncSwitcherVisibility();
    keepRecoveryBackLinkCompact();
    repairBrokenPassengerAvatar(document);
    var observer = new MutationObserver(function (mutations) {
      mountSwitcher();
      syncSwitcherVisibility();
      keepRecoveryBackLinkCompact();
      mutations.forEach(function (mutation) {
        mutation.addedNodes.forEach(function (node) {
          if (node && node.nodeType === 1) repairBrokenPassengerAvatar(node);
        });
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
</script>`;

for (const moduleName of ['corridas', 'entregas']) {
  const moduleIndex = resolve(dist, `modules/${moduleName}/index.html`);
  if (!existsSync(moduleIndex)) continue;
  const html = readFileSync(moduleIndex, 'utf8');
  if (html.includes('apois-superapp-module-bridge')) continue;
  const normalized = moduleName === 'entregas'
    ? html.replaceAll('/./assets/', './assets/').replaceAll('../assets/', './assets/')
    : html;
  const patched = normalized.includes('</body>')
    ? normalized.replace('</body>', `${moduleBridgeScript}\n</body>`)
    : `${normalized}\n${moduleBridgeScript}\n`;
  writeFileSync(moduleIndex, patched, 'utf8');
  console.log(`[OK] alternador de módulos injetado em ${moduleName}`);
}

// A navegação física do Android já é tratada pelo bridge injetado em
// build-isolated-module.mjs. Não registrar um segundo listener aqui: dois
// backButton handlers causam navegação dupla/race no módulo Entregas.
console.log(`[OK] shell cliente gerado em ${dist}: Corridas + Entregas`);
