import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] arquivo ausente: ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireAll(path, markers, label) {
  const source = read(path);
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}
function forbidAll(path, markers, label) {
  const source = read(path);
  const found = markers.filter((marker) => source.includes(marker));
  if (found.length) {
    console.error(`[FAIL] ${label}: ${found.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('.work/entregas/src/routes/notificacoes.tsx', [
  'const rawOrderId = data?.["orderId"] ?? data?.["order_id"] ?? data?.["orderID"]',
  'await navigate({ to: "/pedido/$orderId", params: { orderId } });',
  '<AppBottomNav activeTab="perfil" />',
  'onClick={() => void navigate({ to: "/inicio", replace: true })}',
], 'feed de notificações permanece no produto cliente e abre pedido relacionado');
forbidAll('.work/entregas/src/routes/notificacoes.tsx', [
  'navigate({ to: "/merchant" })',
  'window.history.back()',
], 'feed de notificações não pode abrir painel merchant nem histórico físico');

requireAll('.work/entregas/src/routes/perfil/index.tsx', [
  '{ icon: Bell, label: "Central de notificações", path: "/notificacoes" }',
  '{ icon: Bell, label: "Preferências de notificações", path: "/perfil/notificacoes" }',
  'onError={(event) => { event.currentTarget.style.display = "none"; }}',
], 'perfil separa feed/preferências e possui fallback de avatar');

requireAll('.work/entregas/src/routes/perfil/dados-pessoais.tsx', [
  'onError={(event) => { event.currentTarget.style.display = "none"; }}',
  'accept="image/jpeg,image/png,image/webp"',
  'const maxAvatarBytes = 5 * 1024 * 1024;',
], 'dados pessoais mantém fallback e limites de avatar');

requireAll('scripts/harden-entregas-superapp-image-fallbacks.mjs', [
  "'.work/entregas/src/routes/perfil/index.tsx'",
  "'.work/entregas/src/routes/perfil/dados-pessoais.tsx'",
], 'hardener de imagens cobre avatares');
requireAll('scripts/harden-entregas-superapp-notification-feed.mjs', [
  'payload ainda pode abrir área merchant',
  'Central de notificações',
  'Preferências de notificações',
], 'hardener do feed bloqueia fuga de produto');

process.exit(failed ? 1 : 0);
