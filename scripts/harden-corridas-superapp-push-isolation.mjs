import './harden-corridas-superapp-google-auth.mjs';
import './harden-corridas-cancellation-ui.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function replaceRequired(path, search, replacement, label) {
  const full = resolve(path);
  const before = readFileSync(full, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement), 'utf8');
  console.log(`[OK] ${label}`);
}

replaceRequired(
  '.work/corridas/src/services/push/push-service.ts',
  'import { resolvePushTarget, type PushTarget } from "./push-events";',
  'import { isPushRideEvent, resolvePushTarget, type PushTarget } from "./push-events";',
  'Corridas: serviço Push importa classificador canônico de evento de corrida',
);

replaceRequired(
  '.work/corridas/src/services/push/push-service.ts',
  '    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {\n      if (!isCurrentLifecycle(version)) return;\n      const target = resolvePushTarget(toRecord(action.notification.data));\n      navigateHandler?.(target);\n    }),',
  '    PushNotifications.addListener("pushNotificationActionPerformed", (action) => {\n      if (!isCurrentLifecycle(version)) return;\n      const data = toRecord(action.notification.data);\n      const orderId = data["orderId"] ?? data["order_id"] ?? data["orderID"];\n      const notificationType = data["notificationType"] ?? data["notification_type"];\n      const hasDeliveryMarker =\n        (typeof orderId === "string" && orderId.trim().length > 0) ||\n        (typeof notificationType === "string" && notificationType.trim().length > 0);\n      if (hasDeliveryMarker) return;\n\n      const rideId = data["ride_id"] ?? data["rideId"];\n      const hasRideId = typeof rideId === "string" && rideId.trim().length > 0;\n      if (!isPushRideEvent(data["event"]) && !hasRideId) return;\n\n      const target = resolvePushTarget(data);\n      navigateHandler?.(target);\n    }),',
  'Corridas: listener próprio ignora Push de Entregas e payload desconhecido',
);

console.log('[OK] Corridas: listener nativo permanece restrito a notificações de corrida no package unificado');
