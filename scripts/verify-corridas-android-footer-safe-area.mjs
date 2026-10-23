// Garante que Android edge-to-edge nao esconda as abas do APOIS Cliente.
// Pode ser executado no futuro apos preparar a pasta .work/corridas.
// Nao faz requests, builds ou mudancas no Android.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas');
const layout = readFileSync(resolve(workspace, 'src/routes/_authenticated.tsx'), 'utf8');
const nav = readFileSync(resolve(workspace, 'src/components/BottomNavigation.tsx'), 'utf8');
const marker = 'data-apois-android-nav-safe-v1';

assert.equal(layout.split(marker).length - 1, 1, 'A reserva Android precisa existir uma unica vez');
assert.ok(layout.includes('{!hideBottomNavigation ? <BottomNavigation /> : null}'), 'Navegacao original foi alterada');
assert.ok(layout.includes('pathname === "/buscar-destino"'), 'Busca nao pode receber nav sobreposta');
assert.ok(layout.includes('pathname === "/revisar-solicitacao"'), 'Revisao nao pode receber nav sobreposta');
assert.ok(layout.includes('pathname.startsWith("/corrida/")'), 'Corrida ativa nao pode receber nav sobreposta');
const footer = layout.indexOf('<BottomNavigation />');
const spacer = layout.indexOf(marker);
const toaster = layout.indexOf('<Toaster />');
assert.ok(footer >= 0 && footer < spacer && spacer < toaster, 'Espaco seguro deve ficar apos as abas, antes do Toaster');
assert.ok(layout.includes('{!hideBottomNavigation ? (\n                                        <div'), 'Espaco nao pode aparecer em telas fullscreen');
assert.ok(layout.includes('max(52px, env(safe-area-inset-bottom, 0px))'), 'Reserva precisa cobrir Android antigo e edge-to-edge');
assert.ok(layout.includes('className="w-full shrink-0 bg-white"'), 'Area deve ser nao interativa e igual ao fundo da navegacao');
assert.ok(layout.includes('aria-hidden="true"'), 'Espaco de protecao nao deve interferir na acessibilidade');
assert.ok(nav.includes('grid-cols-5') && nav.includes('min-h-[64px]'), 'Abas originais e alvos de toque alterados');
for(const label of ['Início', 'Corridas', 'Carteira', 'Notificações', 'Perfil'])
  assert.ok(nav.includes(label), 'Aba perdida: '+label);
assert.ok(nav.includes('to={item.path}') && nav.includes('isActive'), 'Links ou estados ativos alterados');
console.log('[OK] APOIS Cliente: cinco abas visiveis acima da navegacao Android, rotas intactas e fullscreen sem rodape.');
