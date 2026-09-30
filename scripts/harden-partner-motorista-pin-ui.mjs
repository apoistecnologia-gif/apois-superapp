import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const path = resolve(process.cwd(), workspace, 'src/routes/motorista.app.tsx');
let source = readFileSync(path, 'utf8');

const marker = 'APOIS_DRIVER_PIN_UI_V2';
if (source.includes(marker)) {
  console.log('[OK] Motorista: PIN UI v2 já aplicado.');
  process.exit(0);
}

source = source.replace(
  'className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in"',
  'className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 backdrop-blur-sm animate-in fade-in"',
);

source = source.replace(
  'className="w-full max-w-md rounded-t-[28px] sm:rounded-[28px] bg-card ring-1 ring-border animate-sheet-in flex flex-col"',
  'className="w-full max-w-md rounded-t-[28px] bg-card ring-1 ring-border animate-sheet-in flex flex-col overflow-hidden"',
);

source = source.replace(
  'maxHeight: "calc(100dvh - env(safe-area-inset-top) - 16px)",',
  'maxHeight: "calc(100dvh - env(safe-area-inset-top) - 8px)",',
);

const inputStart = source.indexOf('              {/* PIN input — herói visual */}');
const inputEnd = source.indexOf('\n\n              {pinError && (', inputStart);
if (inputStart < 0 || inputEnd < 0) {
  throw new Error('[FAIL] Motorista PIN: bloco de entrada do PIN não encontrado');
}

const inputBlock = `              {/* PIN input — herói visual / APOIS_DRIVER_PIN_UI_V2 */}
              <div className="relative mt-5">
                <input
                  autoFocus
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={pinCode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\\D/g, "").slice(0, 4);
                    setPinCode(v);
                    setPinError(null);
                  }}
                  onKeyDown={(e) => { if (e.key === "Enter" && pinCode.length === 4) void submitPin(); }}
                  aria-label="PIN de 4 dígitos"
                  className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
                />
                <div
                  className="grid grid-cols-4 gap-3"
                  aria-hidden="true"
                  onClick={(e) => {
                    const input = e.currentTarget.previousElementSibling as HTMLInputElement | null;
                    input?.focus();
                  }}
                >
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={"flex h-[72px] items-center justify-center rounded-[18px] border-2 bg-background/80 text-[34px] font-black tabular-nums transition " + (pinCode.length > i ? "border-primary text-foreground shadow-[0_0_0_3px_rgba(246,190,28,0.08)]" : "border-border text-muted-foreground")}
                    >
                      {pinCode[i] ?? ""}
                    </div>
                  ))}
                </div>
              </div>`;

source = source.slice(0, inputStart) + inputBlock + source.slice(inputEnd);

const footerStart = source.indexOf('            {/* Footer sticky — CTA sempre visível */}');
const footerEnd = source.indexOf('\n          </div>\n        </div>\n      )}', footerStart);
if (footerStart < 0 || footerEnd < 0) {
  throw new Error('[FAIL] Motorista PIN: footer do modal não encontrado');
}

const footerBlock = `            {/* Footer fixo — CTA sempre visível acima da navegação do app */}
            <div
              className="sticky bottom-0 z-30 shrink-0 border-t border-border/60 bg-card px-5 pt-3 shadow-[0_-18px_34px_-24px_rgba(0,0,0,0.9)]"
              style={{ paddingBottom: "calc(max(env(safe-area-inset-bottom), 12px) + 10px)" }}
            >
              <DSButton
                size="lg"
                onClick={() => void submitPin()}
                disabled={pinBusy || pinCode.length !== 4}
                className="min-h-[56px] w-full text-[15px] font-black uppercase tracking-[0.08em]"
              >
                {pinBusy ? "Validando PIN…" : pinCode.length === 4 ? "Confirmar e iniciar viagem" : "Digite os 4 dígitos"}
              </DSButton>
              <button
                type="button"
                onClick={() => { if (!pinBusy) { setPinOpen(false); setPinCode(""); setPinError(null); } }}
                disabled={pinBusy}
                className="mt-2 min-h-10 w-full text-[12px] font-bold text-muted-foreground disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>`;

source = source.slice(0, footerStart) + footerBlock + source.slice(footerEnd);

for (const required of [
  'APOIS_DRIVER_PIN_UI_V2',
  'grid grid-cols-4 gap-3',
  'text-[34px] font-black',
  'Confirmar e iniciar viagem',
  'z-[120]',
]) {
  if (!source.includes(required)) throw new Error('[FAIL] Motorista PIN UI v2 incompleto: ' + required);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Motorista: PIN com 4 caixas grandes e CTA de confirmação sempre visível.');
