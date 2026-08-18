import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = [
  {
    path: resolve('superapp/shell/dist/index.html'),
    moduleName: 'shell',
    entregasBase: './modules/entregas/index.html',
  },
  {
    path: resolve('superapp/shell/dist/modules/corridas/index.html'),
    moduleName: 'corridas',
    entregasBase: '../entregas/index.html',
  },
];

for (const target of targets) {
  let html = readFileSync(target.path, 'utf8');
  if (html.includes('data-apois-superapp-push-routing')) {
    console.log(`[OK] ${target.moduleName}: roteamento de Push já presente`);
    continue;
  }

  const script = `
<script data-apois-superapp-push-routing>
(() => {
  const targetBase = ${JSON.stringify(target.entregasBase)};
  const pushPlugin = window.Capacitor?.Plugins?.PushNotifications;
  if (!pushPlugin) return;

  function orderTarget(notification) {
    const data = notification?.data || {};
    const orderId = data.orderId || data.order_id || data.orderID;
    if (typeof orderId === 'string' && orderId.trim()) {
      return targetBase + '#/pedido/' + encodeURIComponent(orderId.trim());
    }
    return targetBase + '#/notificacoes';
  }

  pushPlugin.addListener('pushNotificationActionPerformed', (action) => {
    const destination = orderTarget(action?.notification);
    window.location.replace(destination);
  }).catch(() => undefined);
})();
</script>`;

  html = html.includes('</body>')
    ? html.replace('</body>', `${script}\n</body>`)
    : `${html}\n${script}\n`;
  writeFileSync(target.path, html);
  console.log(`[OK] ${target.moduleName}: Push de Entregas roteado para o módulo correto`);
}
