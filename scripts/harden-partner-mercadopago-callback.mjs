import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const sellerCardPath = resolve(root, workspace, 'src/components/payments/MercadoPagoSellerCard.tsx');

if (existsSync(sellerCardPath)) {
  let source = readFileSync(sellerCardPath, 'utf8');
  const legacyInvoke = 'supabase.functions.invoke<OAuthStart>("mercadopago-oauth-start", { body: {} })';
  const partnerInvoke = 'supabase.functions.invoke<OAuthStart>("mercadopago-oauth-start", { body: { appTarget: "partner" } })';

  if (source.includes(legacyInvoke)) source = source.replace(legacyInvoke, partnerInvoke);
  if (!source.includes(partnerInvoke)) {
    throw new Error('APOIS Parceiro: não foi possível fixar o alvo OAuth Mercado Pago como partner.');
  }
  if (source.includes(legacyInvoke)) {
    throw new Error('APOIS Parceiro: chamada OAuth Mercado Pago sem appTarget permaneceu no módulo.');
  }
  writeFileSync(sellerCardPath, source, 'utf8');
  console.log('[OK] APOIS Parceiro: OAuth Mercado Pago solicita retorno exclusivo br.com.apois.parceiro.');
}

const manifestPath = resolve(root, 'superapp/partner-shell/android/app/src/main/AndroidManifest.xml');
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, 'utf8');
  const legacyFilterPattern = /\s*<intent-filter>\s*<action android:name="android\.intent\.action\.VIEW"\s*\/>\s*<category android:name="android\.intent\.category\.DEFAULT"\s*\/>\s*<category android:name="android\.intent\.category\.BROWSABLE"\s*\/>\s*<data android:scheme="br\.com\.apois\.app" android:host="auth" android:pathPrefix="\/mercadopago"\s*\/>\s*<\/intent-filter>/g;
  manifest = manifest.replace(legacyFilterPattern, '\n');

  if (manifest.includes('android:scheme="br.com.apois.app"') && manifest.includes('android:pathPrefix="/mercadopago"')) {
    throw new Error('APOIS Parceiro: callback legado br.com.apois.app://auth/mercadopago ainda está registrado no Android.');
  }
  if (!manifest.includes('android:scheme="br.com.apois.parceiro"')) {
    throw new Error('APOIS Parceiro: scheme nativo br.com.apois.parceiro não está registrado.');
  }
  writeFileSync(manifestPath, manifest, 'utf8');
  console.log('[OK] APOIS Parceiro: Manifest aceita Mercado Pago somente pelo scheme próprio do Parceiro.');
}
