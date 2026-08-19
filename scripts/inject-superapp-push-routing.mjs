import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = [
  {
    path: resolve('superapp/shell/dist/index.html'),
    moduleName: 'shell',
    entregasBase: './modules/entregas/index.html',
    corridasBase: './modules/corridas/index.html',
  },
  {
    path: resolve('superapp/shell/dist/modules/corridas/index.html'),
    moduleName: 'corridas',
    entregasBase: '../entregas/index.html',
    corridasBase: null,
  },
  {
    path: resolve('superapp/shell/dist/modules/entregas/index.html'),
    moduleName: 'entregas',
    entregasBase: null,
    corridasBase: '../corridas/index.html',
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
  const entregasBase = ${JSON.stringify(target.entregasBase)};
  const corridasBase = ${JSON.stringify(target.corridasBase)};
  const pushPlugin = window.Capacitor?.Plugins?.PushNotifications;
  if (!pushPlugin) return;

  const rideEvents = new Set([
    'ride_requested', 'driver_assigned', 'driver_arriving', 'driver_arrived',
    'ride_started', 'ride_completed', 'ride_cancelled', 'cancellation_fee_created',
    'ride.requested', 'ride.accepted', 'ride.driver_arriving', 'ride.driver_arrived',
    'ride.started', 'ride.completed', 'ride.cancelled', 'ride.cancellation_fee_created',
    'driver.new_ride_request',
  ]);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const allowedRideStaticPaths = new Set(['/inicio', '/corridas', '/carteira', '/perfil', '/notificacoes']);

  function payload(notification) {
    return notification?.data && typeof notification.data === 'object' ? notification.data : {};
  }

  function deliveryMarker(data) {
    const orderId = data.orderId || data.order_id || data.orderID;
    const notificationType = data.notificationType || data.notification_type;
    const isDeliveryPush =
      (typeof notificationType === 'string' && notificationType.trim().length > 0) ||
      (typeof orderId === 'string' && orderId.trim().length > 0);
    return {
      orderId: typeof orderId === 'string' ? orderId.trim() : '',
      isDelivery: isDeliveryPush,
    };
  }

  function rideMarker(data) {
    const event = typeof data.event === 'string' ? data.event.trim() : '';
    const rideIdRaw = data.ride_id || data.rideId;
    const rideId = typeof rideIdRaw === 'string' ? rideIdRaw.trim() : '';
    return {
      event,
      rideId,
      isRide: rideEvents.has(event) || uuidPattern.test(rideId),
    };
  }

  function safeRidePath(data, marker) {
    const raw = [data.path, data.deeplink, data.url]
      .find((value) => typeof value === 'string' && value.trim().length > 0);
    if (typeof raw === 'string') {
      let candidate = raw.trim();
      if (candidate.startsWith('#')) candidate = candidate.slice(1);
      if (
        candidate.startsWith('/') &&
        !candidate.startsWith('//') &&
        !/^[a-z][a-z0-9+.-]*:/i.test(candidate)
      ) {
        candidate = candidate.split('?')[0].split('#')[0];
        if (candidate.length > 1 && candidate.endsWith('/')) candidate = candidate.slice(0, -1);
        if (allowedRideStaticPaths.has(candidate)) return candidate;
        const match = /^\/corrida\/([^/]+)$/.exec(candidate);
        if (match && uuidPattern.test(match[1])) return candidate;
      }
    }
    if (marker.event === 'cancellation_fee_created' || marker.event === 'ride.cancellation_fee_created') {
      return '/carteira';
    }
    if (marker.event === 'ride_completed' || marker.event === 'ride_cancelled' || marker.event === 'ride.completed' || marker.event === 'ride.cancelled') {
      return '/corridas';
    }
    return uuidPattern.test(marker.rideId) ? '/corrida/' + marker.rideId : '/corridas';
  }

  function destinationFor(notification) {
    const data = payload(notification);
    const delivery = deliveryMarker(data);
    const ride = rideMarker(data);

    if (delivery.isDelivery && ride.isRide) return null;

    if (delivery.isDelivery) {
      if (!entregasBase) return null;
      return delivery.orderId
        ? entregasBase + '#/pedido/' + encodeURIComponent(delivery.orderId)
        : entregasBase + '#/notificacoes';
    }

    if (ride.isRide) {
      if (!corridasBase) return null;
      return corridasBase + '#' + safeRidePath(data, ride);
    }

    return null;
  }

  pushPlugin.addListener('pushNotificationActionPerformed', (action) => {
    const destination = destinationFor(action?.notification);
    if (!destination) return;
    window.location.replace(destination);
  }).catch(() => undefined);
})();
</script>`;

  html = html.includes('</body>')
    ? html.replace('</body>', `${script}\n</body>`)
    : `${html}\n${script}\n`;
  writeFileSync(target.path, html);
  console.log(`[OK] ${target.moduleName}: Push cruzado Corridas/Entregas roteado apenas para payload reconhecido`);
}
