// APOIS_ANDROID_NAV_SAFE_V1
// Regressao: os labels do rodape Cliente ficam atras dos botoes de navegacao
// do Android (3 botoes/gestos) em WebViews edge-to-edge.
// Em vez de ampliar o padding DENTRO da barra (que pode continuar atras
// do sistema), reserva uma area separada DEPOIS da barra, na coluna flex.
// Nunca modifica destinos, handlers de rota, estado da viagem ou pagamentos.
// Aplicar apos fix-corridas-superapp-ui.mjs (que oculta a barra em corrida,
// busca e revisao), preservando exatamente a mesma condicao hideBottomNavigation.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas');
const layoutFile = resolve(workspace, 'src/routes/_authenticated.tsx');
const before = readFileSync(layoutFile, 'utf8');
const anchor = '{!hideBottomNavigation ? <BottomNavigation /> : null}';
const marker = 'data-apois-android-nav-safe-v1';
let next = before;
if (!next.includes(marker)) {
  if (next.split(anchor).length !== 2) {
    throw new Error('[FAIL] APOIS Android rodape: estrutura esperada de navegacao nao encontrada');
  }
  const addition = `${anchor}
                                      {/* APOIS_ANDROID_NAV_SAFE_V1: area segura fisicamente abaixo do menu,
                                          fora da propria barra; nao ocupa telas de corrida fullscreen. */}
                                      {!hideBottomNavigation ? (
                                        <div
                                          ${marker}="true"
                                          aria-hidden="true"
                                          className="w-full shrink-0 bg-white"
                                          style={{ height: "max(52px, env(safe-area-inset-bottom, 0px))" }}
                                        />
                                      ) : null}`;
  next = next.replace(anchor, addition);
}
const start = next.indexOf('function AuthenticatedLayout() {');
if (start < 0) throw new Error('[FAIL] APOIS Android rodape: layout autenticado ausente');
const footer = next.slice(start);
for (const required of [
  anchor,
  marker,
  'aria-hidden="true"',
  'shrink-0 bg-white',
  'max(52px, env(safe-area-inset-bottom, 0px))',
  'pathname === "/buscar-destino"',
  'pathname.startsWith("/corrida/")',
]) {
  if (!footer.includes(required)) {
    throw new Error('[FAIL] APOIS Android rodape: nao preservou ' + required);
  }
}
if (next !== before) writeFileSync(layoutFile, next, 'utf8');
console.log('[OK] APOIS_ANDROID_NAV_SAFE_V1: 5 abas acima dos botoes Android; paginas fullscreen preservadas.');
