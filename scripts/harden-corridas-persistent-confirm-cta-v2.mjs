import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas';
const path = resolve(root, workspace, 'src/routes/_authenticated.inicio.tsx');
const before = readFileSync(path, 'utf8');
let source = before;

const ctaPattern = /\n\s*<button\n\s*onClick=\{handleReview\}[\s\S]*?Confirmar \{selectedCategory\?\.name \|\| "Solicitação"\}[\s\S]*?<\/button>/;

if (!source.includes('APOIS_PERSISTENT_CONFIRM_CTA_V2')) {
  const match = source.match(ctaPattern);
  if (!match) {
    throw new Error('[FAIL] Corridas CTA persistente V2: CTA canônico handleReview não localizado');
  }

  source = source.replace(match[0], '');

  const anchor = `        </BottomSheet>
      )}`;
  if (!source.includes(anchor)) {
    throw new Error('[FAIL] Corridas CTA persistente V2: fechamento do BottomSheet não localizado');
  }

  const floatingCta = `        </BottomSheet>
      )}

      {/* APOIS_PERSISTENT_CONFIRM_CTA_V2 — CTA sempre visível acima da navegação inferior. */}
      {(hasDestination || route) && !isFormOpen && !isPaymentListOpen && (
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(70px+env(safe-area-inset-bottom)+10px)] z-[120] mx-auto w-full max-w-[430px] px-4">
          <div className="pointer-events-auto rounded-[22px] border border-white/8 bg-[#08090B]/94 p-2 shadow-[0_-12px_36px_rgba(0,0,0,.48)] backdrop-blur-xl">
            <button
              type="button"
              onClick={handleReview}
              disabled={!checkout.readiness || !!routeError}
              aria-label={"Confirmar " + (selectedCategory?.name || "Solicitação")}
              className={cn(
                "apois-ride-confirm-cta flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[17px] px-5 py-3.5 text-base font-black transition-all active:scale-[0.985]",
                checkout.readiness && !routeError
                  ? "bg-gradient-to-r from-[#F5222D] to-[#FF1F2D] text-white shadow-[0_12px_28px_rgba(245,34,45,.30)]"
                  : "bg-zinc-800 text-zinc-500"
              )}
            >
              Confirmar {selectedCategory?.name || "Solicitação"}
              <ChevronRight size={20} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}`;

  source = source.replace(anchor, floatingCta);
}

source = source
  .replace('className="w-full pb-4"', 'className="w-full pb-28"')
  .replace('className="animate-in fade-in slide-in-from-bottom duration-300 space-y-4 pb-2"', 'className="animate-in fade-in slide-in-from-bottom duration-300 space-y-4 pb-4"');

for (const marker of [
  'APOIS_PERSISTENT_CONFIRM_CTA_V2',
  'bottom-[calc(70px+env(safe-area-inset-bottom)+10px)]',
  'z-[120]',
  'onClick={handleReview}',
  'disabled={!checkout.readiness || !!routeError}',
  'aria-label={"Confirmar " + (selectedCategory?.name || "Solicitação")}',
  'Confirmar {selectedCategory?.name || "Solicitação"}',
  'pb-28',
]) {
  if (!source.includes(marker)) {
    throw new Error('[FAIL] Corridas CTA persistente V2: marcador ausente (' + marker + ')');
  }
}

const handleReviewButtons = (source.match(/onClick=\{handleReview\}/g) || []).length;
if (handleReviewButtons !== 1) {
  throw new Error('[FAIL] Corridas CTA persistente V2: esperado exatamente 1 CTA handleReview; encontrados ' + handleReviewButtons);
}

if (source.includes('apois-ride-confirm-cta sticky bottom-0')) {
  throw new Error('[FAIL] Corridas CTA persistente V2: CTA sticky legado ainda presente');
}

if (source !== before) writeFileSync(path, source, 'utf8');
console.log('[OK] APOIS_PERSISTENT_CONFIRM_CTA_V2: botão Confirmar permanece visível acima da navegação inferior.');
