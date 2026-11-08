import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/courier.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace(
  'import { Loader2, RefreshCw, UserRound, XCircle } from "lucide-react";',
  'import { AlertTriangle, Loader2, RefreshCw, UserRound, XCircle } from "lucide-react";',
);

if (!source.includes('const [operationsError, setOperationsError]')) {
  const anchor = '  const [appError, setAppError] = useState<string | null>(null);';
  if (!source.includes(anchor)) throw new Error('Entregador Parceiro: estado appError não encontrado.');
  source = source.replace(
    anchor,
    `${anchor}\n  const [operationsError, setOperationsError] = useState<string | null>(null);`,
  );
}

const unsafeAssignments = `    setAvailability(availabilityRes.data ?? null);
    setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
    setNearbyMerchants(merchantsRes.data ?? []);
    setActiveJob(jobsRes.data ?? null);
    setWallet(walletRes.data ?? null);`;
const safeAssignments = `    const criticalOperationErrors = [availabilityRes.error, offersRes.error, jobsRes.error, merchantsRes.error].filter(Boolean);
    if (criticalOperationErrors.length > 0) {
      console.warn("courier operations refresh failed", criticalOperationErrors.map((error: any) => error?.message));
      setOperationsError("Não foi possível atualizar chamadas ou a entrega ativa. Seus dados anteriores foram mantidos.");
    } else {
      setOperationsError(null);
    }

    // Nunca transforme uma falha de rede em estado vazio/offline. Mantemos o
    // último dado válido e atualizamos cada fatia apenas quando a consulta dela
    // realmente respondeu sem erro.
    if (!availabilityRes.error) setAvailability(availabilityRes.data ?? null);
    if (!offersRes.error) setOffers(Array.isArray(offersRes.data) ? offersRes.data : []);
    if (!merchantsRes.error) setNearbyMerchants(merchantsRes.data ?? []);
    if (!jobsRes.error) setActiveJob(jobsRes.data ?? null);
    if (!walletRes.error) setWallet(walletRes.data ?? null);`;
if (source.includes(unsafeAssignments)) source = source.replace(unsafeAssignments, safeAssignments);

// Idempotente: envolver `setDeliveryHistory` duas vezes aninhava blocos
// `if/else` repetidos e o arquivo continuava sintaticamente válido, mas
// crescia a cada execução. Só aplicamos quando o guarda ainda não existe.
if (!source.includes('courier history refresh failed')) {
  source = source.replace(
    `    setDeliveryHistory(historyRes.data ?? []);`,
    `    if (historyRes.error) {
      console.warn("courier history refresh failed", historyRes.error.message);
    } else {
      setDeliveryHistory(historyRes.data ?? []);
    }`,
  );
}

const statusCard = `        <CourierStatusCard
          online={online}
          busy={busy === "online"}
          activeJob={activeJob}
          onToggle={toggleOnline}
        />`;
const statusWithError = `${statusCard}

        {operationsError && (
          <section
            role="alert"
            className="rounded-[1.25rem] border border-amber-400/25 bg-amber-400/10 p-3.5 text-amber-100"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">Atualização temporariamente indisponível</p>
                <p className="mt-1 text-xs leading-5 text-amber-100/75">{operationsError}</p>
                <button
                  type="button"
                  onClick={() => courier?.id && void loadCourierOperations(courier.id)}
                  className="mt-3 min-h-11 rounded-xl border border-amber-300/25 bg-black/30 px-4 text-xs font-bold uppercase tracking-[0.08em] text-amber-200 active:scale-[0.98]"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </section>
        )}`;
if (!source.includes('Atualização temporariamente indisponível')) {
  if (!source.includes(statusCard)) throw new Error('Entregador Parceiro: CourierStatusCard não encontrado.');
  source = source.replace(statusCard, statusWithError);
}

for (const marker of [
  'AlertTriangle, Loader2',
  'const [operationsError, setOperationsError]',
  'criticalOperationErrors',
  'Seus dados anteriores foram mantidos.',
  'if (!jobsRes.error) setActiveJob',
  'if (!offersRes.error) setOffers',
  'courier history refresh failed',
  'Atualização temporariamente indisponível',
  'Tentar novamente',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: estados operacionais incompletos (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: falha de refresh não apaga oferta/entrega ativa e possui erro visível com tentativa novamente.');
