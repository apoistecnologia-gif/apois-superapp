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
if (pngSignature !== '89504e470d0a1a0a' || officialBrandingBytes.length < 1024 || pngWidth < 64 || pngHeight < 64) {
  console.error('[FAIL] arte oficial APOIS em base64 não decodifica para um PNG válido');
  process.exit(1);
}
mkdirSync(resolve(dist, 'assets'), { recursive: true });
writeFileSync(resolve(dist, 'assets/apois-brand.png'), officialBrandingBytes);
console.log(`[OK] arte oficial APOIS decodificada para o shell cliente (${pngWidth}x${pngHeight})`);

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
    button.style.right = '14px';
    button.style.top = 'calc(max(env(safe-area-inset-top), 12px) + 56px)';
    button.style.zIndex = '2147483646';
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
    repairBrokenPassengerAvatar(document);
    var observer = new MutationObserver(function (mutations) {
      mountSwitcher();
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

// O shell entra nos módulos usando location.replace(), portanto o WebView não mantém
// uma entrada anterior no histórico. No Android isso fazia o botão nativo "Voltar"
// ficar sem efeito dentro do módulo Entregas. Injetamos um handler apenas no bundle
// embarcado do Superapp, sem alterar o comportamento do APK independente de Entregas.
const entregasIndex = resolve(dist, 'modules/entregas/index.html');
if (existsSync(entregasIndex)) {
  const backNavigationScript = `
<script id="apois-superapp-entregas-back-navigation">
(function () {
  var appPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!appPlugin || typeof appPlugin.addListener !== 'function') return;

  function routePath() {
    var hash = String(window.location.hash || '').replace(/^#/, '');
    var path = hash.split('?')[0] || '/';
    return path.charAt(0) === '/' ? path : '/' + path;
  }

  Promise.resolve(appPlugin.addListener('backButton', function () {
    var path = routePath();

    // Login/cadastro públicos voltam para a tela inicial do APOIS Entregas.
    if (path === '/login' || path === '/register' || path === '/cadastro' || path === '/recuperar-senha') {
      window.location.hash = '#/';
      return;
    }

    // Na tela inicial do Entregas, voltar retorna ao seletor Corridas/Entregas.
    if (path === '/') {
      window.location.replace('../../index.html');
      return;
    }

    // Demais telas respeitam o histórico do módulo; sem histórico, retornam ao início.
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = '#/';
    }
  })).catch(function () {});
})();
</script>`;

  const html = readFileSync(entregasIndex, 'utf8');
  if (!html.includes('apois-superapp-entregas-back-navigation')) {
    const patched = html.includes('</body>')
      ? html.replace('</body>', `${backNavigationScript}\n</body>`)
      : `${html}\n${backNavigationScript}\n`;
    writeFileSync(entregasIndex, patched, 'utf8');
    console.log('[OK] navegação do botão Voltar Android injetada no módulo Entregas');
  }
}

console.log(`[OK] shell cliente gerado em ${dist}: Corridas + Entregas`);
