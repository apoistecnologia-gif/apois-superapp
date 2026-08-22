import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/routes/motorista.termos.tsx', (source) => {
  let next = source;
  if (!next.includes('from "@capacitor/browser"')) {
    next = next.replace(
      'import { createFileRoute, useRouter } from "@tanstack/react-router";',
      'import { createFileRoute, useRouter } from "@tanstack/react-router";\nimport { Capacitor } from "@capacitor/core";\nimport { Browser } from "@capacitor/browser";',
    );
  }

  const oldRedirect = `      if (alive && url && /^https?:\\/\\//i.test(url)) {\n        window.location.replace(url);\n        return;\n      }`;
  const safeRedirect = `      if (alive && url && /^https?:\\/\\//i.test(url)) {\n        if (Capacitor.isNativePlatform()) {\n          try {\n            await Browser.open({ url });\n          } catch (error) {\n            if (import.meta.env.DEV) console.warn(\"[APOIS Legal] falha ao abrir termos públicos\", error);\n          }\n          if (alive) setChecking(false);\n          return;\n        }\n        window.location.replace(url);\n        return;\n      }`;
  if (next.includes(oldRedirect)) next = next.replace(oldRedirect, safeRedirect);

  if (!next.includes('await Browser.open({ url });')) {
    throw new Error('[FAIL] motorista.termos.tsx: termos externos ainda podem substituir o WebView do Parceiro');
  }
  return next;
}, 'motorista: termos públicos abrem no Browser nativo sem sequestrar o módulo');

console.log(`[OK] navegação legal do Motorista endurecida em ${workspace}`);
