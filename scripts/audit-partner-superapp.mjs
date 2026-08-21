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

// O callback legado br.com.apois.app://auth/mercadopago ainda é aceito pelo host
// Parceiro para compatibilidade com o backend atual. Isso é uma pendência controlada:
// não bloquear o release até o backend emitir br.com.apois.parceiro, mas manter o
// marcador explícito para que a dívida não desapareça silenciosamente.
requireAll('scripts/configure-partner-android.mjs', [
  'android:scheme="br.com.apois.app"',
  'android:pathPrefix="/mercadopago"',
  'retorno legado',
], 'callback Mercado Pago legado permanece explicitamente documentado até migração do backend');

process.exit(failed ? 1 : 0);
