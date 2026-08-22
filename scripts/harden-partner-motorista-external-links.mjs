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

patch('src/lib/driverPrefs.ts', (source) => {
  let next = source;
  if (!next.includes('from "@capacitor/browser"')) {
    next = `import { Browser } from "@capacitor/browser";\nimport { Capacitor } from "@capacitor/core";\n` + next;
  }
  const old = `function openExternal(url: string) {\n  const popup = window.open(url, "_blank", "noopener,noreferrer");\n  if (popup) popup.opener = null;\n}`;
  const replacement = `function openExternal(url: string) {\n  if (Capacitor.isNativePlatform()) {\n    void Browser.open({ url }).catch((error) => {\n      if (import.meta.env.DEV) console.warn("[APOIS Navigation] falha ao abrir aplicativo externo", error);\n    });\n    return;\n  }\n  const popup = window.open(url, "_blank", "noopener,noreferrer");\n  if (popup) popup.opener = null;\n}`;
  if (next.includes(old)) next = next.replace(old, replacement);
  if (!next.includes('void Browser.open({ url })')) throw new Error('[FAIL] driverPrefs.ts: navegação externa ainda depende somente de window.open');
  return next;
}, 'motorista: Google Maps/Waze externos usam Browser nativo no APK');

patch('src/routes/motorista.privacidade.tsx', (source) => {
  let next = source;
  if (!next.includes('from "@capacitor/browser"')) {
    next = next.replace(
      'import { createFileRoute } from "@tanstack/react-router";',
      'import { createFileRoute } from "@tanstack/react-router";\nimport { Browser } from "@capacitor/browser";\nimport { Capacitor } from "@capacitor/core";',
    );
  }
  if (!next.includes('function openPartnerExternal')) {
    const marker = 'function PrivacidadeMotoristaPage() {';
    const helper = `function openPartnerExternal(event: React.MouseEvent<HTMLAnchorElement>, url: string) {\n  if (!Capacitor.isNativePlatform()) return;\n  event.preventDefault();\n  void Browser.open({ url }).catch((error) => {\n    if (import.meta.env.DEV) console.warn(\"[APOIS Privacy] falha ao abrir link externo\", error);\n  });\n}\n\n`;
    if (!next.includes(marker)) throw new Error('[FAIL] motorista.privacidade.tsx: componente não encontrado');
    next = next.replace(marker, helper + marker);
  }
  next = next.replace(
    '                href="https://apoisbrasil.com.br/privacidade"\n                target="_blank"',
    '                href="https://apoisbrasil.com.br/privacidade"\n                onClick={(event) => openPartnerExternal(event, "https://apoisbrasil.com.br/privacidade")}\n                target="_blank"',
  );
  next = next.replace(
    '                href="https://apoisbrasil.com.br/excluir-conta"\n                target="_blank"',
    '                href="https://apoisbrasil.com.br/excluir-conta"\n                onClick={(event) => openPartnerExternal(event, "https://apoisbrasil.com.br/excluir-conta")}\n                target="_blank"',
  );
  for (const marker of ['Browser.open({ url })', 'openPartnerExternal(event, "https://apoisbrasil.com.br/privacidade")', 'openPartnerExternal(event, "https://apoisbrasil.com.br/excluir-conta")']) {
    if (!next.includes(marker)) throw new Error(`[FAIL] motorista.privacidade.tsx: link externo seguro ausente (${marker})`);
  }
  return next;
}, 'motorista: links públicos de privacidade/exclusão abrem no Browser nativo');

console.log(`[OK] links externos do Motorista endurecidos em ${workspace}`);
