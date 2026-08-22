import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let failed = false;
function read(path) {
  const full = resolve(path);
  if (!existsSync(full)) {
    console.error(`[FAIL] Mobile UI v16: arquivo ausente ${path}`);
    failed = true;
    return '';
  }
  return readFileSync(full, 'utf8');
}
function requireAll(path, markers, label) {
  const source = read(path);
  if (!source) return;
  const missing = markers.filter((marker) => !source.includes(marker));
  if (missing.length) {
    console.error(`[FAIL] ${label}: ${missing.join(' | ')}`);
    failed = true;
  } else console.log(`[OK] ${label}`);
}

requireAll('scripts/harden-superapp-shell-mobile-ui.mjs', [
  'overflow-x:hidden;overflow-y:auto',
  'object-fit:contain;padding:6px',
  '@media(max-height:720px)',
  '.service{min-height:265px}',
], 'Seletor Cliente não corta logo/conteúdo em aparelhos baixos');

requireAll('scripts/harden-partner-shell-mobile-ui.mjs', [
  'overflow-x:hidden;overflow-y:auto',
  'object-fit:contain;padding:8px',
  '@media(max-height:700px)',
  '@media(max-width:360px)',
], 'Seletor Parceiro adapta logo, cards e rolagem a telas pequenas');

requireAll('scripts/harden-superapp-module-mobile-ui.mjs', [
  'min-h-[64px]',
  'text-[11px]',
  '<Icon size={24} strokeWidth={2.2} />',
  'pt-[max(env(safe-area-inset-top),0.75rem)]',
  'text-xs font-semibold text-zinc-300',
  'min-h-[88px]',
  'pb-[max(env(safe-area-inset-bottom),1.25rem)]',
  'label: "Meus pedidos"',
  'label: "Favoritos"',
  'Perfil remove atalhos duplicados do rodapé',
], 'Módulos Cliente mantêm rodapés tocáveis, cabeçalhos legíveis e removem atalhos duplicados do Perfil');

requireAll('.apois/modules.json', [
  'node scripts/harden-superapp-module-mobile-ui.mjs corridas',
  'node scripts/harden-superapp-module-mobile-ui.mjs entregas',
], 'Hardening visual roda antes da compilação real de Corridas e Entregas');

requireAll('superapp/shell/build.mjs', [
  "import '../../scripts/harden-superapp-shell-mobile-ui.mjs';",
], 'Shell Cliente aplica hardening visual antes de copiar para dist');
requireAll('scripts/harden-partner-shell-startup.mjs', [
  "import './harden-partner-shell-mobile-ui.mjs';",
], 'Shell Parceiro aplica hardening visual junto ao bootstrap nativo');

requireAll('scripts/harden-entregas-superapp-auth-runtime.mjs', [
  '<nav className="fixed bottom-0',
  'min-h-[88px]',
  'min-h-[64px] min-w-[72px]',
  'h-8 w-8',
  'text-xs leading-none',
  'pb-32',
], 'Entregas mantém rodapé persistente e conteúdo não fica coberto');

requireAll('scripts/fix-corridas-superapp-ui.mjs', [
  'superappJourneyRoutesWithoutBottomNav',
  '!pathname.startsWith("/corrida/")',
  'aria-label="Navegação inferior"',
], 'Corridas mantém rodapé nas telas comuns e oculta apenas jornada operacional');

if (!failed) console.log('[OK] Mobile UI v16: seletores e módulos unificados têm safe-area, rolagem, logomarca sem corte, navegação inferior consistente e menos duplicidade visual.');
process.exit(failed ? 1 : 0);
