import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const javaRoot = resolve('superapp/partner-shell/android/app/src/main/java/br/com/apois/parceiro');
const targets = [
  { file: 'DriverLocationService.java', module: 'motorista' },
  { file: 'CourierLocationService.java', module: 'entregador' },
];

for (const { file, module } of targets) {
  const path = resolve(javaRoot, file);
  let source = readFileSync(path, 'utf8');
  if (!source.includes('import android.net.Uri;')) {
    const anchor = 'import android.location.Location;';
    if (!source.includes(anchor)) throw new Error(`[FAIL] ${file}: import Location não encontrado para deep link da notificação`);
    source = source.replace(anchor, `${anchor}\nimport android.net.Uri;`);
  }
  const marker = `br.com.apois.parceiro://module/${module}`;
  if (!source.includes(marker)) {
    const anchor = '        openApp.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);';
    if (!source.includes(anchor)) throw new Error(`[FAIL] ${file}: PendingIntent da notificação não encontrado`);
    source = source.replace(anchor, `${anchor}\n        openApp.setData(Uri.parse("${marker}"));`);
  }
  if (!source.includes(marker) || !source.includes('openApp.setData(Uri.parse(')) {
    throw new Error(`[FAIL] ${file}: notificação de localização não volta ao módulo ${module}`);
  }
  writeFileSync(path, source, 'utf8');
}

console.log('[OK] Notificações persistentes de GPS do Parceiro retornam diretamente ao Motorista/Entregador em vez de abrir o seletor e permitir troca de função sem reconciliação.');
