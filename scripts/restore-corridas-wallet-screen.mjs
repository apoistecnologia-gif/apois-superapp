// APOIS_CLIENT_WALLET_SCREEN_V1
// Substitui APENAS a tela provisoria "Sua Carteira" do APOIS Cliente.
// Os dados sao lidos dos hooks/servicos financeiros ja existentes: nao cria
// saldo, nao paga taxas, nao faz update e nao modifica as regras do servidor.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workspace = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas');
const file = resolve(workspace, 'src/routes/_authenticated.carteira.tsx');
const before = readFileSync(file, 'utf8');

const page = String.raw`import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, CreditCard, LockKeyhole, ReceiptText, RefreshCw, Wallet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useWallet } from "@/hooks/use-wallet";
import { usePaymentMethods } from "@/hooks/use-payment-methods";
import { paymentService } from "@/services/payments/payment-service";
import type { CancellationFee } from "@/types/payments";

// APOIS_CLIENT_WALLET_SCREEN_V1: interface de leitura, sem operacoes de cobranca.
export const Route = createFileRoute("/_authenticated/carteira")({
  component: CarteiraPage,
});

const formatMoney = (amount: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amount);

const formatDate = (value: string): string | null => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getTime() === 0) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};

type PendingFeesState = "loading" | "ready" | "failed";

function CarteiraPage() {
  const { profile, authState, isLoading: authLoading } = useAuth();
  // INV-021: cancellation_fees.passenger_id references public.users.id.
  const domainUserId = profile?.id ?? null;
  const { wallet, state, isLoading, refresh } = useWallet();
  const { methods, selectedMethod, isLoading: methodsLoading } = usePaymentMethods();
  const [fees, setFees] = useState<CancellationFee[]>([]);
  const [feesState, setFeesState] = useState<PendingFeesState>("loading");
  const [refreshing, setRefreshing] = useState(false);
  const feeRequest = useRef(0);

  const loadFees = useCallback(async (): Promise<void> => {
    const requestId = ++feeRequest.current;
    setFees([]);
    if (!domainUserId) {
      setFeesState(authState === "initializing" || authState === "loading_profile" || authLoading ? "loading" : "failed");
      return;
    }
    setFeesState("loading");
    try {
      const pending = await paymentService.getCancellationFees(domainUserId);
      if (requestId !== feeRequest.current) return;
      setFees(pending);
      setFeesState("ready");
    } catch {
      if (requestId !== feeRequest.current) return;
      setFeesState("failed");
    }
  }, [domainUserId, authState, authLoading]);

  useEffect(() => {
    void loadFees();
    return () => {
      feeRequest.current += 1;
    };
  }, [loadFees]);

  const refreshAll = async (): Promise<void> => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await Promise.all([refresh(), loadFees()]);
    } finally {
      setRefreshing(false);
    }
  };

  const currentMethod = methods.find((method) => method.code === selectedMethod && method.isActive);
  const walletReady = (state === "available" || state === "blocked") && wallet !== null;
  const latestUpdate = walletReady ? formatDate(wallet.updatedAt) : null;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#F7F7F8] text-[#111827]">
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-8 pt-[max(22px,env(safe-area-inset-top))]">
        <header className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#C9141B]">APOIS Cliente</p>
            <h1 className="mt-1 text-[29px] font-black tracking-tight">Minha Carteira</h1>
            <p className="mt-1 text-sm text-[#626B78]">Consulte seu saldo e as pendências financeiras.</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={refreshing || isLoading}
            aria-label="Atualizar carteira e pendências"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E2E4E8] bg-white text-[#C9141B] shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
          </button>
        </header>

        <section aria-label="Saldo da carteira" className="rounded-[26px] bg-[#E51B23] px-5 py-6 text-white shadow-[0_12px_28px_rgba(229,27,35,0.17)]">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-white/90"><Wallet size={19} /> Saldo da carteira</span>
            {state === "blocked" ? (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Bloqueada</span>
            ) : null}
          </div>

          {state === "loading" || (isLoading && !walletReady) ? (
            <div className="mt-5 h-11 w-40 animate-pulse rounded-xl bg-white/25" aria-label="Carregando saldo" role="status" />
          ) : walletReady ? (
            <p className="mt-4 break-words text-[34px] font-black tabular-nums tracking-tight">{formatMoney(wallet.balance)}</p>
          ) : (
            <p className="mt-5 text-xl font-extrabold">{state === "not_found" ? "Carteira ainda indisponível" : "Saldo não disponível"}</p>
          )}

          {state === "blocked" && wallet ? (
            <p className="mt-2 flex items-center gap-2 text-sm text-white/95"><LockKeyhole size={16} /> Saldo temporariamente indisponível para uso.</p>
          ) : state === "not_found" ? (
            <p className="mt-2 text-sm text-white/90">Nenhuma carteira foi localizada para sua conta.</p>
          ) : state === "failed" ? (
            <p className="mt-2 text-sm text-white/90">Não foi possível consultar o saldo. Atualize para tentar novamente.</p>
          ) : (
            <p className="mt-2 text-sm text-white/90">Valor informado pelo sistema financeiro APOIS.</p>
          )}
          {latestUpdate ? <p className="mt-4 text-xs text-white/80">Atualizado em {latestUpdate}</p> : null}
        </section>

        {state === "blocked" && wallet ? (
          <section aria-label="Aviso de bloqueio" className="mt-4 flex items-start gap-3 rounded-2xl border border-[#F3D09E] bg-[#FFFBEB] p-4 text-[#8A4B08]">
            <LockKeyhole size={20} className="mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-extrabold">Carteira bloqueada</h2>
              <p className="mt-1 text-xs leading-relaxed">O saldo registrado não está disponível para pagamentos enquanto durar o bloqueio.</p>
              {wallet.blockedReason ? <p className="mt-2 break-words text-xs">Motivo informado: {wallet.blockedReason}</p> : null}
            </div>
          </section>
        ) : null}

        <section className="mt-5 rounded-[24px] border border-[#E2E4E8] bg-white p-5 shadow-sm" aria-label="Taxas de cancelamento pendentes">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#C9141B]"><ReceiptText size={22} /></div>
            <div className="min-w-0">
              <h2 className="text-base font-black">Taxas de cancelamento</h2>
              <p className="text-xs text-[#626B78]">Somente pendências registradas na sua conta</p>
            </div>
          </div>
          {feesState === "loading" ? (
            <p role="status" className="mt-5 text-sm text-[#626B78]">Consultando pendências...</p>
          ) : feesState === "failed" ? (
            <div className="mt-4 flex gap-2 rounded-xl bg-[#FFF1F2] p-3 text-sm text-[#A71820]">
              <AlertCircle size={18} className="shrink-0" />
              <p>Não foi possível consultar as taxas. Use Atualizar para tentar novamente.</p>
            </div>
          ) : fees.length === 0 ? (
            <p className="mt-5 rounded-xl bg-[#F6F7F8] p-3 text-sm text-[#626B78]">Nenhuma taxa pendente encontrada.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {fees.map((fee) => (
                <li key={fee.id} className="flex items-start justify-between gap-3 border-b border-[#EFF0F2] pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{fee.reason || "Taxa de cancelamento"}</p>
                    {formatDate(fee.createdAt) ? <p className="mt-1 text-xs text-[#737985]">{formatDate(fee.createdAt)}</p> : null}
                    <p className="mt-1 text-xs font-semibold text-[#B91C1C]">Pendente</p>
                  </div>
                  <strong className="shrink-0 text-sm tabular-nums text-[#B91C1C]">{formatMoney(fee.amount)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-4 rounded-[24px] border border-[#E2E4E8] bg-white p-5 shadow-sm" aria-label="Forma de pagamento selecionada">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#C9141B]"><CreditCard size={22} /></div>
            <div className="min-w-0">
              <h2 className="text-base font-black">Forma de pagamento</h2>
              <p className="mt-1 text-sm text-[#626B78]">
                {methodsLoading ? "Carregando..." : currentMethod?.name ?? "Nenhuma forma selecionada"}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-[#818793]">Você pode alterar a forma de pagamento ao solicitar uma corrida.</p>
        </section>

        <p className="mt-5 text-center text-xs leading-relaxed text-[#818793]">
          O saldo e as pendências exibidos são consultados na sua conta. Esta tela não realiza cobranças nem transferências.
        </p>
      </main>
    </div>
  );
}
`;

if (!before.includes('APOIS_CLIENT_WALLET_SCREEN_V1')) {
  if (!before.includes('createFileRoute("/_authenticated/carteira")') ||
      !before.includes('function CarteiraPage()') ||
      !before.includes('Sua Carteira') ||
      before.includes('useWallet')) {
    throw new Error('[FAIL] Carteira: fonte nao corresponde ao placeholder original; nenhuma substituicao feita');
  }
  writeFileSync(file, page, 'utf8');
}
const updated = readFileSync(file, 'utf8');
for (const marker of [
  'APOIS_CLIENT_WALLET_SCREEN_V1',
  'const domainUserId = profile?.id ?? null;',
  'useWallet()',
  'paymentService.getCancellationFees(domainUserId)',
  'state === "blocked"',
  'state === "failed"',
  'state === "not_found"',
  'Nenhuma taxa pendente encontrada.',
  'currentMethod?.name',
]) {
  if (!updated.includes(marker)) throw new Error('[FAIL] Carteira: interface incompleta ' + marker);
}
if (updated.includes('function CarteiraPage() {\n  return <div')) {
  throw new Error('[FAIL] Carteira: placeholder ainda presente');
}
console.log('[OK] APOIS_CLIENT_WALLET_SCREEN_V1: tela real usando carteira e taxas existentes, sem mutacoes financeiras.');
