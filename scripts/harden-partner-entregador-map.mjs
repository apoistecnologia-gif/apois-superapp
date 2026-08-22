import './harden-partner-entregador-theme.mjs';
import './harden-partner-entregador-journey.mjs';
import './harden-partner-entregador-online-bootstrap.mjs';
import './harden-partner-entregador-resume.mjs';
import './harden-partner-entregador-active-delivery.mjs';
import './harden-partner-entregador-active-tracking.mjs';
import './harden-partner-entregador-offer-expiry.mjs';
import './harden-partner-entregador-map-camera.mjs';
import './harden-partner-entregador-touch-safearea.mjs';
import './harden-partner-entregador-finance.mjs';
import './harden-partner-entregador-finance-runtime.mjs';
import './harden-partner-entregador-profile.mjs';
import './harden-partner-entregador-profile-switch.mjs';
import './harden-partner-entregador-selector-access.mjs';
import './harden-partner-entregador-session-hygiene.mjs';
import './harden-partner-entregador-privacy.mjs';
import './harden-partner-entregador-terms.mjs';
import './harden-partner-entregador-operation-states.mjs';
import './harden-partner-entregador-action-timeouts.mjs';
import './harden-partner-entregador-state-handoff.mjs';
import './harden-partner-entregador-gps-resume.mjs';
import './harden-partner-entregador-background-location.mjs';
import './harden-partner-entregador-native-session-sync.mjs';
import './harden-partner-entregador-native-token-forward.mjs';
import './harden-partner-entregador-background-reconciliation.mjs';
import './harden-partner-entregador-operational-lock.mjs';
import './harden-partner-entregador-back-navigation.mjs';
import './harden-partner-entregador-quiet-refresh.mjs';
import './harden-partner-entregador-push-runtime.mjs';
import './harden-entregas-brand-sweep.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/components/CourierRouteMap.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace('const BRAND_GREEN = "#39B54A";\nconst BRAND_PURPLE = "#6A1B9A";', 'const APOIS_GOLD = "#F6BE1C";');
source = source.replaceAll('BRAND_PURPLE', 'APOIS_GOLD');
source = source.replace('const BRAND_GREEN = "#39B54A";\n', '');
source = source.replace('const APOIS_GOLD = "#C88A08";', 'const APOIS_GOLD = "#F6BE1C";');

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
if (source.includes('const BRAND_PURPLE') || source.includes('const BRAND_GREEN')) throw new Error('Entregador Parceiro: constantes de marca verde/roxa antigas permaneceram no mapa.');
if (source.includes('center={{ lat: currentPosition.lat, lng: currentPosition.lng }}\n              zoom={14}')) {
  throw new Error('Entregador Parceiro: mapa de espera ainda força a câmera em cada atualização do GPS.');
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: branding residual removido, operação online travada na função Entregador, sessão WebView/GPS nativo coordenada e mapa resiliente.');
