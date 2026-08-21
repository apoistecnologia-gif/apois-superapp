import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const sellerCardPath = resolve(root, workspace, 'src/components/payments/MercadoPagoSellerCard.tsx');

if (!existsSync(sellerCardPath)) {
  throw new Error(`APOIS Parceiro: cartão Mercado Pago não encontrado em ${sellerCardPath}`);
}

let source = readFileSync(sellerCardPath, 'utf8');
const legacyInvoke = 'supabase.functions.invoke<OAuthStart>("mercadopago-oauth-start", { body: {} })';
const partnerInvoke = 'supabase.functions.invoke<OAuthStart>("mercadopago-oauth-start", { body: { appTarget: "partner" } })';

if (source.includes(legacyInvoke)) {
  source = source.replace(legacyInvoke, partnerInvoke);
}
if (!source.includes(partnerInvoke)) {
  throw new Error('APOIS Parceiro: não foi possível fixar o alvo OAuth Mercado Pago como partner.');
}
if (source.includes(legacyInvoke)) {
  throw new Error('APOIS Parceiro: chamada OAuth Mercado Pago sem appTarget permaneceu no módulo.');
}

writeFileSync(sellerCardPath, source, 'utf8');
console.log('[OK] APOIS Parceiro: OAuth Mercado Pago solicita retorno exclusivo br.com.apois.parceiro.');
