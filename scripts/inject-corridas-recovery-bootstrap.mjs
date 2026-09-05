import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const indexPath = resolve('.work/corridas/dist/index.html');
let html = readFileSync(indexPath, 'utf8');

if (!html.includes('data-apois-corridas-recovery-bootstrap')) {
  const script = `
<script data-apois-corridas-recovery-bootstrap>
(() => {
  const recoveryKey = 'apois-superapp:corridas-recovery-url';
  const isRecoveryUrl = (url) => typeof url === 'string' && url.startsWith('br.com.apois.app://auth/corridas-reset');
  const openRecovery = (url) => {
    if (!isRecoveryUrl(url)) return false;
    try { sessionStorage.setItem(recoveryKey, url); } catch {}
    if (window.location.hash !== '#/redefinir-senha') window.location.replace('./index.html#/redefinir-senha');
    return true;
  };

  try {
    const pending = sessionStorage.getItem(recoveryKey);
    if (pending && window.location.hash !== '#/redefinir-senha') {
      window.location.replace('./index.html#/redefinir-senha');
      return;
    }
  } catch {}

  const app = window.Capacitor?.Plugins?.App;
  if (!app) return;
  Promise.resolve(app.addListener('appUrlOpen', ({ url }) => { openRecovery(url); })).catch(() => undefined);
  Promise.resolve(app.getLaunchUrl?.()).then((result) => { if (result?.url) openRecovery(result.url); }).catch(() => undefined);
})();
</script>`;
  html = html.includes('</body>') ? html.replace('</body>', `${script}\n</body>`) : `${html}\n${script}`;
  writeFileSync(indexPath, html, 'utf8');
}

if (!html.includes('data-apois-corridas-recovery-bootstrap') || !html.includes('br.com.apois.app://auth/corridas-reset')) {
  throw new Error('[FAIL] Corridas: bootstrap de recuperação não entrou no dist');
}
console.log('[OK] Corridas: dist encaminha recuperação nativa para #/redefinir-senha');
