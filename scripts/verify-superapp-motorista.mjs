import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function check(path, markers, label) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] ${label}: arquivo ausente ${path}`);
    failed = true;
    return;
  }
  const source = readFileSync(full, 'utf8');
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

check('superapp/shell/dist/modules/motorista/index.html', ['data-apois-superapp-bridge'], 'bundle Motorista contém bridge do Superapp');
check('.work/motorista/src/integrations/supabase/client.ts', ["storageKey: 'apois-superapp-motorista-auth-v1'"], 'Motorista usa sessão isolada');
check('.work/motorista/src/routes/motorista.assinatura.tsx', ['driver-membership-checkout', 'MercadoPagoSellerCard'], 'Mensalidade Motorista usa gateway roteável e vínculo Mercado Pago');
check('.work/motorista/src/components/payments/MercadoPagoSellerCard.tsx', ['mercadopago-driver-status', 'mercadopago-oauth-start', 'Conectar Mercado Pago'], 'Motorista possui onboarding Mercado Pago seguro');
check('superapp/shell/index.html', ['./modules/motorista/index.html', 'apois-superapp-motorista-auth-v1', "path==='mercadopago'"], 'Shell expõe Motorista e retorno OAuth');

const htmlPath = resolve('superapp/shell/dist/modules/motorista/index.html');
if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, 'utf8');
  if (/\b(?:src|href)=["']\/(?!\/)/.test(html)) {
    console.error('[FAIL] Motorista contém asset absoluto incompatível com módulo aninhado');
    failed = true;
  } else console.log('[OK] Motorista usa assets relativos');
}

process.exit(failed ? 1 : 0);
