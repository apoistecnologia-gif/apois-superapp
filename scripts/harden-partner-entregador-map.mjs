import './harden-partner-entregador-theme.mjs';
import './harden-partner-entregador-journey.mjs';
import './harden-partner-entregador-resume.mjs';
import './harden-partner-entregador-active-delivery.mjs';
import './harden-partner-entregador-offer-expiry.mjs';
import './harden-partner-entregador-map-camera.mjs';
import './harden-partner-entregador-touch-safearea.mjs';
import './harden-partner-entregador-finance.mjs';
import './harden-partner-entregador-operation-states.mjs';
import './harden-partner-entregador-action-timeouts.mjs';
import './harden-partner-entregador-gps-resume.mjs';
import './harden-partner-entregador-quiet-refresh.mjs';
import './harden-partner-entregador-push-runtime.mjs';
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

// O mapa de espera não deve ser controlado pela posição GPS a cada render.
// Com `center`, qualquer atualização de localização puxava a câmera de volta e
// impedia o entregador de explorar o mapa. O botão de recentralizar já existe.
source = source.replace(
  '              center={{ lat: currentPosition.lat, lng: currentPosition.lng }}\n              zoom={14}',
  '              defaultCenter={{ lat: currentPosition.lat, lng: currentPosition.lng }}\n              defaultZoom={14}',
);

for (const marker of [
  'const APOIS_GOLD = "#F6BE1C";',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_APOIS_GOOGLE_MAPS_BROWSER_KEY',
  '"DEMO_MAP_ID"',
  'strokeColor: APOIS_GOLD',
  'defaultCenter={{ lat: currentPosition.lat, lng: currentPosition.lng }}',
  'defaultZoom={14}',
]) {
  if (!source.includes(marker)) throw new Error(`Entregador Parceiro: hardening do mapa incompleto (${marker}).`);
}
if (source.includes('const BRAND_PURPLE')) throw new Error('Entregador Parceiro: rota roxa antiga permaneceu no mapa.');
if (source.includes('center={{ lat: currentPosition.lat, lng: currentPosition.lng }}\n              zoom={14}')) {
  throw new Error('Entregador Parceiro: mapa de espera ainda força a câmera em cada atualização do GPS.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: restauração em segundo plano, GPS rearmado no retorno, refresh silencioso preserva a entrega, Push isolado por produto, jornada nativa, entrega ativa resiliente, finanças protegidas, estados operacionais explícitos, ações sem spinner infinito, ofertas com expiração visível, controles ampliados, mapa dourado e câmera livre durante atualizações do GPS.');
