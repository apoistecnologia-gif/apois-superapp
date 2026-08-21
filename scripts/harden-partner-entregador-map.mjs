import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/components/CourierRouteMap.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace('const BRAND_GREEN = "#39B54A";\nconst BRAND_PURPLE = "#6A1B9A";', 'const APOIS_GOLD = "#F6BE1C";');
source = source.replaceAll('BRAND_PURPLE', 'APOIS_GOLD');

const oldBrowserKey = 'const browserKey = (import.meta as any).env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined;';
const newBrowserKey = 'const browserKey = ((import.meta as any).env.VITE_GOOGLE_MAPS_BROWSER_KEY || (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || (import.meta as any).env.VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY) as string | undefined;';
source = source.replaceAll(oldBrowserKey, newBrowserKey);

const oldMapId = 'const mapId = (import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID as string | undefined;';
const newMapId = 'const mapId = ((import.meta as any).env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID") as string;';
source = source.replaceAll(oldMapId, newMapId);

source = source.replaceAll('browserKey && mapId && currentPosition', 'browserKey && currentPosition');
source = source.replaceAll('{browserKey && mapId\n            ? "Aguardando o GPS retornar sua posição atual."\n            : "Mapa indisponível: configuração do Google Maps não foi carregada."}', '{browserKey\n            ? "Aguardando o GPS retornar sua posição atual."\n            : "Mapa indisponível: chave do Google Maps não foi carregada."}');
source = source.replaceAll('browserKey && mapId ? (', 'browserKey ? (');
source = source.replaceAll('shadow-[0_8px_22px_rgba(106,27,154,0.24)]', 'shadow-[0_8px_22px_rgba(246,190,28,0.20)]');

for (const marker of [
  'const APOIS_GOLD = "#F6BE1C";',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY',
  '"DEMO_MAP_ID"',
  'strokeColor: APOIS_GOLD',
]) {
  if (!source.includes(marker)) throw new Error(`Entregador Parceiro: hardening do mapa incompleto (${marker}).`);
}
if (source.includes('const BRAND_PURPLE')) throw new Error('Entregador Parceiro: rota roxa antiga permaneceu no mapa.');

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: mapa usa chave APOIS disponível, Map ID resiliente, tema escuro e rota dourada.');
