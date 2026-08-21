import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Parceiro: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}
function forbidAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('scripts/build-partner-modules.sh', [
  'bun install --frozen-lockfile',
  'APOIS_MOTORISTA_WORKSPACE=".work/partner-motorista"',
  'APOIS_ENTREGAS_WORKSPACE=".work/partner-entregador"',
  'APOIS_ENTREGAS_AUTH_SCHEME="br.com.apois.parceiro"',
  'VITE_APOIS_NATIVE_SCHEME="br.com.apois.parceiro"',
  'harden-partner-mercadopago-callback.mjs',
  'harden-motorista-mercadopago-disconnect.mjs',
  'appTarget: "partner"',
  'Conectar Mercado Pago',
  'mercadopago-oauth-start',
  'Siga a rota até o ponto de embarque',
  'Como foi o passageiro?',
], 'build Parceiro preserva lockfiles, auth isolado, Mercado Pago e jornada do motorista');

requireAll('scripts/configure-partner-android.mjs', [
  "ensurePermission('android.permission.ACCESS_FINE_LOCATION')",
  "ensurePermission('android.permission.ACCESS_COARSE_LOCATION')",
  "ensurePermission('android.permission.POST_NOTIFICATIONS')",
  'android:scheme="br.com.apois.parceiro"',
  'android:scheme="apoismotorista"',
  'registerPlugin(DriverVoicePlugin.class)',
  'com.google.android.tts',
], 'Android Parceiro possui localização, notificações, deep links e voz nativa');

forbidAll('scripts/configure-partner-android.mjs', [
  'android.permission.REQUEST_INSTALL_PACKAGES',
  'android.permission.WRITE_EXTERNAL_STORAGE',
], 'Parceiro não solicita permissões Android de instalação/armazenamento desnecessárias');

requireAll('scripts/harden-partner-android-security.mjs', [
  "['compileSdkVersion', 36]",
  "['targetSdkVersion', 36]",
  "setApplicationAttribute('allowBackup', 'false')",
  "setApplicationAttribute('usesCleartextTraffic', 'false')",
  'PARTNER_VERSION_CODE',
  'PARTNER_VERSION_NAME',
  'android.permission.ACCESS_BACKGROUND_LOCATION',
  'android.permission.REQUEST_INSTALL_PACKAGES',
  'android.permission.WRITE_EXTERNAL_STORAGE',
], 'Parceiro fixa API 36, versão e reduz superfície de dados/permissões');

requireAll('scripts/harden-partner-mercadopago-callback.mjs', [
  'appTarget: "partner"',
  'legacyFilterPattern',
  'android:scheme="br.com.apois.app"',
  'android:pathPrefix="/mercadopago"',
  'android:scheme="br.com.apois.parceiro"',
], 'Parceiro migra OAuth Mercado Pago para callback próprio e remove registro legado no Android');

requireAll('scripts/install-partner-launcher.mjs', [
  "import './harden-partner-mercadopago-callback.mjs';",
  "import './harden-partner-android-security.mjs';",
  'android:allowBackup="false"',
  'android:usesCleartextTraffic="false"',
  'android:scheme="br.com.apois.parceiro"',
  'Manifest Parceiro ainda registra callback Mercado Pago do app cliente.',
], 'launcher Parceiro valida isolamento OAuth antes de finalizar recursos Android');

requireAll('codemagic.yaml', [
  'android-partner-superapp:',
  'PARTNER_APP_PACKAGE: "br.com.apois.parceiro"',
  'PARTNER_APP_LABEL: "APOIS Parceiro"',
  'npm run build:partner',
  'APOIS-Parceiro.apk',
], 'Codemagic possui workflow separado e assinado do APOIS Parceiro');

requireAll('scripts/harden-motorista-field-mercadopago.mjs', [
  'mercadopago-driver-status',
  'mercadopago-oauth-start',
  'Conectar Mercado Pago',
], 'Motorista possui vínculo Mercado Pago direto');

requireAll('scripts/harden-motorista-mercadopago-disconnect.mjs', [
  'disconnect_my_mercadopago_driver',
  'Desconectar Mercado Pago',
], 'Motorista pode trocar conta Mercado Pago sem fluxo antigo de saque');

process.exit(failed ? 1 : 0);
