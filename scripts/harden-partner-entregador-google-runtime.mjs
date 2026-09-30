import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const filePath = resolve(root, workspace, 'src/components/GoogleLoginButton.tsx');
let source = readFileSync(filePath, 'utf8');

if (!source.includes('const browserListenerRef = useRef<PluginListenerHandle | null>(null);')) {
  source = source.replace(
    '  const appListenerRef = useRef<PluginListenerHandle | null>(null);',
    '  const appListenerRef = useRef<PluginListenerHandle | null>(null);\n  const browserListenerRef = useRef<PluginListenerHandle | null>(null);',
  );
}

source = source.replace(
  '      void appListenerRef.current?.remove();\n      appListenerRef.current = null;',
  '      void appListenerRef.current?.remove();\n      appListenerRef.current = null;\n      void browserListenerRef.current?.remove();\n      browserListenerRef.current = null;',
);

source = source.replace(
  '    try {\n      await Browser.close().catch(() => undefined);',
  '    try {\n      await browserListenerRef.current?.remove();\n      browserListenerRef.current = null;\n      await Browser.close().catch(() => undefined);',
);

source = source.replace(
  '        await Browser.open({ url: data.url });',
  '        if (!browserListenerRef.current) {\n          browserListenerRef.current = await Browser.addListener("browserFinished", () => {\n            setLoading(false);\n            void browserListenerRef.current?.remove();\n            browserListenerRef.current = null;\n          });\n        }\n\n        await Browser.open({ url: data.url });',
);

for (const marker of [
  'browserListenerRef',
  'Browser.addListener("browserFinished"',
  'await browserListenerRef.current?.remove();',
]) {
  if (!source.includes(marker)) throw new Error('[FAIL] Entregador Google runtime incompleto: ' + marker);
}

writeFileSync(filePath, source, 'utf8');
console.log('[OK] Entregador Parceiro: Google libera loading ao fechar/cancelar navegador e evita listener órfão.');
