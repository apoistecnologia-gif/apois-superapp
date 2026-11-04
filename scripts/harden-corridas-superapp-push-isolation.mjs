import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/corridas/src/services/push/push-service.ts');
let source = readFileSync(path, 'utf8');

if (!source.includes('isPushRideEvent')) {
  source = source.replace(
    'import { resolvePushTarget, type PushTarget } from "./push-events";',
    'import { isPushRideEvent, resolvePushTarget, type PushTarget } from "./push-events";',
  );
}

const oldListener = `    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {\n      const target = resolvePushTarget(toRecord(action.notification.data));\n      navigateHandler?.(target);\n    }),`;
const newListener = `    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {\n      const data = toRecord(action.notification.data);\n      const orderId = data["orderId"] ?? data["order_id"] ?? data["orderID"];\n      const notificationType = data["notificationType"] ?? data["notification_type"];\n      const hasDeliveryMarker =\n        (typeof orderId === "string" && orderId.trim().length > 0) ||\n        (typeof notificationType === "string" && notificationType.trim().length > 0);\n      if (hasDeliveryMarker) return;\n\n      const rideId = data["ride_id"] ?? data["rideId"];\n      const hasRideId = typeof rideId === "string" && rideId.trim().length > 0;\n      if (!isPushRideEvent(data["event"]) && !hasRideId) return;\n\n      const target = resolvePushTarget(data);\n      navigateHandler?.(target);\n    }),`;
if (!source.includes(newListener)) {
  if (!source.includes(oldListener)) throw new Error('[FAIL] Corridas: listener Push atual não encontrado');
  source = source.replace(oldListener, newListener);
}

for (const marker of [
  'isPushRideEvent',
  'const hasDeliveryMarker =',
  'if (hasDeliveryMarker) return;',
  'if (!isPushRideEvent(data["event"]) && !hasRideId) return;',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Corridas: isolamento Push incompleto (${marker})`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Corridas: listener Push atual ignora Entregas e payload desconhecido no package unificado');
