import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/routes/checkout.tsx');
let source = readFileSync(path, 'utf8');

const postAuthRuntime = `      const { data: providerSetting } = await (supabase.rpc as any)("get_order_payment_provider");
      const configuredProvider =
        typeof providerSetting === "string" ? providerSetting.trim().toLowerCase() : "";
      if (!new Set(["openpix", "asaas"]).has(configuredProvider)) {
        throw new Error("O pagamento PIX está temporariamente indisponível. Tente novamente em instantes.");
      }
      const pixFunction =
        configuredProvider === "asaas" ? "create-asaas-pix-charge" : "create-pix-charge";`;

const merchantHardenerInput = `      const { data: providerSetting } = await (supabase.rpc as any)("get_order_payment_provider");
      const configuredProvider =
        typeof providerSetting === "string" ? providerSetting.trim().toLowerCase() : "mercadopago";
      const pixFunction =
        configuredProvider === "asaas" ? "create-asaas-pix-charge" : "create-pix-charge";`;

const finalDirectProvider = '      const pixFunction = "create-merchant-mercadopago-pix";';

if (source.includes(finalDirectProvider)) {
  console.log('[OK] Entregas: checkout já aponta para Mercado Pago direto do estabelecimento.');
} else if (source.includes(postAuthRuntime)) {
  source = source.replace(postAuthRuntime, merchantHardenerInput);
  writeFileSync(path, source, 'utf8');
  console.log('[OK] Entregas: handoff do checkout normalizado para hardening Mercado Pago do estabelecimento.');
} else if (source.includes(merchantHardenerInput)) {
  console.log('[OK] Entregas: handoff do checkout já está normalizado.');
} else {
  throw new Error('[FAIL] Entregas: bloco financeiro do checkout mudou; não é seguro escolher provedor automaticamente.');
}
