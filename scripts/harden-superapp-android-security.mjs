import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifestPath = resolve('superapp/shell/android/app/src/main/AndroidManifest.xml');
let xml = readFileSync(manifestPath, 'utf8');

function setApplicationAttribute(name, value) {
  const pattern = new RegExp(`android:${name}="[^"]*"`);
  if (pattern.test(xml)) {
    xml = xml.replace(pattern, `android:${name}="${value}"`);
    return;
  }
  xml = xml.replace('<application', `<application\n        android:${name}="${value}"`);
}

// O APK armazena sessões Supabase e estado operacional no WebView. Não permita
// que o Android restaure esse conteúdo automaticamente em outro aparelho/instalação.
setApplicationAttribute('allowBackup', 'false');

// Todas as APIs usadas pelo Superapp são HTTPS. Bloquear cleartext reduz o risco
// de downgrade/acesso acidental a endpoints HTTP em produção.
setApplicationAttribute('usesCleartextTraffic', 'false');

writeFileSync(manifestPath, xml, 'utf8');

const finalXml = readFileSync(manifestPath, 'utf8');
for (const marker of ['android:allowBackup="false"', 'android:usesCleartextTraffic="false"']) {
  if (!finalXml.includes(marker)) {
    throw new Error(`Hardening Android não aplicado: ${marker}`);
  }
}

console.log('[OK] Android: backup de dados sensíveis desabilitado e tráfego cleartext bloqueado.');
