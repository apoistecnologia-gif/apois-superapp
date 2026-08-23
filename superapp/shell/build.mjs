import '../../scripts/harden-superapp-shell-auth.mjs';
import '../../scripts/harden-superapp-shell-mobile-ui.mjs';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)));
const dist = resolve(root, 'dist');
const officialBranding = resolve(root, '../branding/apois-launcher.png');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(resolve(root, 'index.html'), resolve(dist, 'index.html'));

if (!existsSync(officialBranding)) {
  console.error(`[FAIL] arte oficial APOIS não existe em ${officialBranding}`);
  process.exit(1);
}
mkdirSync(resolve(dist, 'assets'), { recursive: true });
cpSync(officialBranding, resolve(dist, 'assets/apois-brand.png'));
console.log('[OK] arte oficial APOIS copiada para o shell cliente');

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

  appPlugin.addListener('backButton', function () {
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
  }).catch(function () {});
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
