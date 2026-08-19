import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('scripts/harden-entregas-superapp-auth-runtime.mjs');
let source = readFileSync(path, 'utf8');

const oldBlock = `  if (!before.includes(search)) {\n    console.error(\`[FAIL] \${label}: padrão esperado não encontrado em \${path}\`);\n    process.exit(1);\n  }\n  writeFileSync(full, before.replace(search, replacement));`;

const newBlock = `  if (!before.includes(search)) {\n    if (\n      label === 'entregas: listener próprio ignora notificações pertencentes a Corridas' &&\n      before.includes('function notificationTarget(notification?: PushNotificationSchema)') &&\n      before.includes('export async function installCustomerPushListeners()')\n    ) {\n      const start = before.indexOf('function notificationTarget(notification?: PushNotificationSchema)');\n      const end = before.indexOf('export async function installCustomerPushListeners()', start);\n      if (start >= 0 && end > start) {\n        const after = before.slice(0, start) + replacement + '\\n\\n' + before.slice(end);\n        writeFileSync(full, after);\n        console.log(\`[OK] \${label} (normalizado por estrutura)\`);\n        return;\n      }\n    }\n    console.error(\`[FAIL] \${label}: padrão esperado não encontrado em \${path}\`);\n    process.exit(1);\n  }\n  writeFileSync(full, before.replace(search, replacement));`;

if (source.includes(newBlock)) {
  console.log('[OK] hardener de Entregas já tolera formato adaptado de customer-push.');
  process.exit(0);
}
if (!source.includes(oldBlock)) {
  throw new Error('Hardener de Entregas mudou: bloco replaceRequired não encontrado.');
}
source = source.replace(oldBlock, newBlock);
writeFileSync(path, source, 'utf8');
console.log('[OK] hardener de Entregas passou a normalizar notificationTarget por estrutura quando necessário.');
