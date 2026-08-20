import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista-test';

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

patch('src/lib/googleMaps.ts', (source) => {
  const replacement = `// No APK/Superapp usamos primeiro a chave browser configurada no ambiente APOIS.\n// Mantemos as variáveis legadas apenas como fallback para preservar compatibilidade web.\nexport const GOOGLE_MAPS_API_KEY =\n  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ??\n  (import.meta.env.VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ??\n  (import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined) ??\n  \"\";`;

  if (source.includes(replacement)) return source;

  const exportStart = source.indexOf('export const GOOGLE_MAPS_API_KEY =');
  if (exportStart < 0) throw new Error('googleMaps.ts: export GOOGLE_MAPS_API_KEY não encontrado');

  const statementEnd = source.indexOf(';', exportStart);
  if (statementEnd < 0) throw new Error('googleMaps.ts: fim do export GOOGLE_MAPS_API_KEY não encontrado');

  let commentStart = source.lastIndexOf('\n//', exportStart);
  if (commentStart < 0) commentStart = exportStart;
  else commentStart += 1;

  return `${source.slice(0, commentStart)}${replacement}${source.slice(statementEnd + 1)}`;
}, 'motorista: Google Maps usa chave APOIS do Codemagic');

patch('vite.mobile.config.ts', (source) => {
  if (source.includes('base: "./"')) return source;
  const marker = '  return {\n    appType: "spa",';
  if (!source.includes(marker)) throw new Error('vite.mobile.config.ts: marcador appType não encontrado');
  return source.replace(marker, '  return {\n    base: "./",\n    appType: "spa",');
}, 'motorista: assets relativos para APK/Superapp Parceiro');

patch('src/mobile.tsx', (source) => {
  let next = source;
  if (!next.includes('createHashHistory')) {
    next = next.replace(
      'import { createRouter, RouterProvider } from "@tanstack/react-router";',
      'import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";',
    );
  }
  if (!next.includes('history: createHashHistory()')) {
    const marker = '  const router = createRouter({\n';
    if (!next.includes(marker)) throw new Error('mobile.tsx: createRouter não encontrado');
    next = next.replace(marker, '  const router = createRouter({\n    history: createHashHistory(),\n');
  }
  return next;
}, 'motorista: Hash History no APOIS Parceiro');

patch('src/components/AuthShell.tsx', (source) => {
  let next = source;
  next = next.replace('<DSCardHeader>', '<DSCardHeader className="text-center">');
  next = next.replace('<DSCardTitle className="text-2xl">{title}</DSCardTitle>', '<DSCardTitle className="text-center text-2xl">{title}</DSCardTitle>');
  next = next.replace('<DSCardDescription>{description}</DSCardDescription>', '<DSCardDescription className="text-center">{description}</DSCardDescription>');

  if (!next.includes('Voltar para escolher perfil')) {
    const marker = '        <div className="flex w-full flex-col space-y-6">';
    if (!next.includes(marker)) throw new Error('AuthShell.tsx: container principal não encontrado');
    next = next.replace(marker, `${marker}\n          <button\n            type="button"\n            onClick={() => window.location.replace('../../index.html')}\n            className="mx-auto inline-flex min-h-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-4 text-xs font-bold text-muted-foreground"\n          >\n            ← Voltar para escolher perfil\n          </button>`);
  }
  return next;
}, 'motorista: login centralizado e retorno ao seletor');

patch('src/components/DriverSideMenu.tsx', (source) => {
  if (source.includes('Trocar perfil de parceiro')) return source;
  const marker = `              {onLogout ? (\n                <button`;
  if (!source.includes(marker)) throw new Error('DriverSideMenu.tsx: botão de logout não encontrado');
  const chooser = `              <button\n                type="button"\n                onClick={() => window.location.replace('../../index.html')}\n                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-[#F6BE1C]/20 bg-[#F6BE1C]/8 px-4 text-[12px] font-black uppercase tracking-[0.12em] text-[#F6BE1C] transition active:scale-[0.99]"\n              >\n                Trocar perfil de parceiro\n              </button>\n\n`;
  return source.replace(marker, chooser + marker);
}, 'motorista: menu permite voltar ao seletor Motorista/Entregador');

console.log(`[OK] hardening de campo concluído em ${workspace}`);
