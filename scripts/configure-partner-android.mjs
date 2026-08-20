import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const manifestPath = resolve(root, 'superapp/partner-shell/android/app/src/main/AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');

function ensurePermission(name) {
  if (manifest.includes(`android:name="${name}"`)) return;
  manifest = manifest.replace('<application', `    <uses-permission android:name="${name}" />\n\n    <application`);
}

ensurePermission('android.permission.ACCESS_FINE_LOCATION');
ensurePermission('android.permission.ACCESS_COARSE_LOCATION');
ensurePermission('android.permission.POST_NOTIFICATIONS');

// OAuth do Mercado Pago já está configurado no backend com o retorno legado
// br.com.apois.app://auth/mercadopago. O APK Parceiro registra esse scheme para
// permitir a homologação sem mudar a configuração financeira antes da hora.
if (!manifest.includes('android:scheme="br.com.apois.app"')) {
  const filter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="br.com.apois.app" android:host="auth" android:pathPrefix="/mercadopago" />\n            </intent-filter>`;
  manifest = manifest.replace('</activity>', `${filter}\n        </activity>`);
}

if (!manifest.includes('android:scheme="br.com.apois.parceiro"')) {
  const filter = `\n            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="br.com.apois.parceiro" android:host="auth" />\n            </intent-filter>`;
  manifest = manifest.replace('</activity>', `${filter}\n        </activity>`);
}

writeFileSync(manifestPath, manifest, 'utf8');
console.log('[OK] APOIS Parceiro Android: localização, notificações e OAuth configurados');
