import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed=false;
const read=(p)=>{const f=resolve(p);if(!existsSync(f)){console.error('[FAIL] arquivo ausente: '+p);failed=true;return ''}return readFileSync(f,'utf8')};
const requireMarkers=(p,markers,label)=>{const s=read(p);if(!s)return;const missing=markers.filter(m=>!s.includes(m));if(missing.length){console.error('[FAIL] '+label+': '+missing.join(' | '));failed=true}else console.log('[OK] '+label)};
const forbidMarkers=(p,markers,label)=>{const s=read(p);if(!s)return;const found=markers.filter(m=>s.includes(m));if(found.length){console.error('[FAIL] '+label+': '+found.join(' | '));failed=true}else console.log('[OK] '+label)};

requireMarkers('scripts/harden-entregas-payment-provider-boundary.mjs',[
  "const PAYMENT_STORAGE_KEY = 'apois-superapp-entregas:payment-method';",
  'const paymentMethod = "pix";',
  'paymentMethod: "pix"',
  '"safe2pay-create-order-pix"',
  '"safe2pay-payment-status"',
  'configuredProvider = "safe2pay_marketplace"',
  'pixResponse?.pix?.copyPaste',
],'Boundary Entregas aponta checkout exclusivamente para Safe2Pay');

forbidMarkers('scripts/harden-entregas-payment-provider-boundary.mjs',[
  'create-merchant-mercadopago-pix',
  'create-asaas-pix-charge',
  'create-pix-charge',
  'openpix-payout',
  'sync-payment-status',
  'merchant-payment-readiness',
],'Boundary Entregas não mantém gateway aposentado executável');

requireMarkers('scripts/harden-entregas-direct-payment-operations.mjs',[
  'function isOperationalPayment(order: MerchantOrder)',
  'return status === "paid";',
  'const paymentReady = isOperationalPayment(order);',
  'isAlertableOrderPayment(order.payment_method, order.payment_status)',
],'Operação merchant só libera pedido após confirmação financeira');

forbidMarkers('scripts/harden-entregas-direct-payment-operations.mjs',[
  'method === "cash" && status === "pending"',
],'Operação merchant não trata cash/pending como pagamento confirmado');

requireMarkers('.apois/modules.json',[
  'harden-entregas-payment-provider-boundary.mjs',
  'harden-entregas-direct-payment-operations.mjs',
  'bun run build:customer',
],'Hardeners Safe2Pay são aplicados antes do build customer');

requireMarkers('supabase/entregas-forward-migrations/20260921173500_safe2pay_marketplace_foundation.sql',[
  'merchant_safe2pay_accounts',
  'safe2pay_order_transactions',
  'safe2pay_webhook_events',
  'round(merchant_amount::numeric, 2) = round(amount::numeric, 2)',
],'Foundation Safe2Pay do estabelecimento/ordem está versionada');

requireMarkers('supabase/entregas-forward-migrations/20260921175000_select_safe2pay_provider.sql',[
  "'order_payment_provider'",
  "'\"safe2pay_marketplace\"'::jsonb",
  "'safe2pay_provider_enabled'",
  "'false'::jsonb",
],'Safe2Pay é provider alvo, mas permanece fail-closed antes da homologação');

requireMarkers('sources/apois-entregas/supabase/migrations/20260826051214_courier_manual_settlements.sql',[
  'merchant pays the courier directly via',
  'APOIS never custodies or moves this money',
  "v_mode not in ('marketplace_direct_live', 'merchant_manual')",
  "'delivery_available', v_mode in ('marketplace_direct_live', 'merchant_manual')",
],'Settlement do entregador permanece merchant_manual sem custódia APOIS');

requireMarkers('supabase/entregas-forward-migrations/20260905114500_enable_merchant_manual_courier_mode.sql',[
  "values ('courier_payout_mode', '\"merchant_manual\"'::jsonb)",
  "to_regclass('public.courier_settlements')",
  "to_regprocedure('public.get_delivery_checkout_readiness()')",
],'Modo merchant_manual permanece explícito e forward-only');

process.exit(failed?1:0);
