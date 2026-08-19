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

  function deliveryTarget(notification) {
    const data = notification?.data || {};
    const orderId = data.orderId || data.order_id || data.orderID;
    const notificationType = data.notificationType || data.notification_type;

    // O dispatch de Entregas sempre inclui notificationType e os eventos de
    // pedido incluem orderId. Sem um desses marcadores, o push pertence a outro
    // módulo (por exemplo Corridas) e este bridge não deve navegar.
    const isDeliveryPush =
      (typeof notificationType === 'string' && notificationType.trim().length > 0) ||
      (typeof orderId === 'string' && orderId.trim().length > 0);
    if (!isDeliveryPush) return null;

    if (typeof orderId === 'string' && orderId.trim()) {
      return targetBase + '#/pedido/' + encodeURIComponent(orderId.trim());
    }
    return targetBase + '#/notificacoes';
  }

  pushPlugin.addListener('pushNotificationActionPerformed', (action) => {
    const destination = deliveryTarget(action?.notification);
    if (!destination) return;
    window.location.replace(destination);
  }).catch(() => undefined);
})();
</script>`;

  html = html.includes('</body>')
    ? html.replace('</body>', `${script}\n</body>`)
    : `${html}\n${script}\n`;
  writeFileSync(target.path, html);
  console.log(`[OK] ${target.moduleName}: Push de Entregas roteado sem interceptar outros módulos`);
}
