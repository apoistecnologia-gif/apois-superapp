import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A prontidão de entrega já existe no snapshot. O modelo de produto atual NÃO
// depende de gateway de payout: a fonte versiona merchant_manual, no qual o
// estabelecimento paga o entregador diretamente e a APOIS apenas controla o
// fechamento/regularidade. Mantemos o gate de checkout, mas garantimos que a
// infraestrutura aceita esse modo e que o switch forward-only está versionado.
const checkoutPath = resolve('.work/entregas/src/routes/checkout.tsx');
const checkout = readFileSync(checkoutPath, 'utf8');

const requiredCheckoutMarkers = [
  'const [deliveryPlatformAvailable, setDeliveryPlatformAvailable] = useState(true);',
  'const [deliveryUnavailableMessage, setDeliveryUnavailableMessage] = useState<string | null>(null);',
  'get_delivery_checkout_readiness',
  'disabled={merchantConfig?.delivery_enabled === false || !deliveryPlatformAvailable}',
  '{!deliveryPlatformAvailable && deliveryUnavailableMessage ? (',
];
const missingCheckout = requiredCheckoutMarkers.filter((marker) => !checkout.includes(marker));
if (missingCheckout.length) {
  throw new Error(`[FAIL] Entregas: readiness de entrega incompleto (${missingCheckout.join(', ')}).`);
}

const manualMigrationPath = resolve('.work/entregas/supabase/migrations/20260826051214_courier_manual_settlements.sql');
if (!existsSync(manualMigrationPath)) {
  throw new Error('[FAIL] Entregas: migration do settlement manual de entregadores ausente no snapshot.');
}
const manualMigration = readFileSync(manualMigrationPath, 'utf8');
for (const marker of [
  "v_mode not in ('marketplace_direct_live', 'merchant_manual')",
  "'delivery_available', v_mode in ('marketplace_direct_live', 'merchant_manual')",
  'merchant pays the courier directly via',
  'APOIS never custodies or moves this money',
]) {
  if (!manualMigration.includes(marker)) {
    throw new Error(`[FAIL] Entregas: modelo merchant_manual incompleto (${marker}).`);
  }
}

const switchPath = resolve('supabase/entregas-forward-migrations/20260905114500_enable_merchant_manual_courier_mode.sql');
if (!existsSync(switchPath)) {
  throw new Error('[FAIL] Entregas: switch forward-only para merchant_manual não está versionado.');
}
const switchMigration = readFileSync(switchPath, 'utf8');
for (const marker of [
  "values ('courier_payout_mode', '\"merchant_manual\"'::jsonb)",
  "to_regclass('public.courier_settlements')",
  "to_regprocedure('public.get_delivery_checkout_readiness()')",
]) {
  if (!switchMigration.includes(marker)) {
    throw new Error(`[FAIL] Entregas: switch merchant_manual incompleto (${marker}).`);
  }
}

console.log('[OK] Entregas: checkout mantém readiness e o modo merchant_manual sem custódia/gateway está versionado para ativação controlada.');
