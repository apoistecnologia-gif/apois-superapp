import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";

// APOIS_CLIENT_ACCOUNT_DELETION_V1
// O RPC de Corridas usa auth.uid(), rejeita corridas ativas e faz soft deletion.
// O snapshot de tipos da fonte ainda não inclui esta RPC já existente na produção.
type DeletionResult = { ok?: boolean };
type DeletionError = { code?: string; message: string };
const requestDeletion = supabase.rpc as unknown as (
  name: "request_own_account_deletion"
) => Promise<{ data: DeletionResult | null; error: DeletionError | null }>;

export function PassengerAccountDeletion({
  onConfirmed,
}: {
  onConfirmed: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy || completed) return;
    setOpen(false);
    setConfirmation("");
    setError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || completed || confirmation.trim() !== "EXCLUIR") return;
    setBusy(true);
    setError(null);
    let serverConfirmed = false;
    try {
      const { data, error: rpcError } = await requestDeletion("request_own_account_deletion");
      if (rpcError) {
        if (rpcError.code === "55000" || rpcError.message.includes("active_ride_blocks_account_deletion")) {
          setError("Há uma corrida ativa. Finalize ou cancele a corrida antes de excluir a conta.");
          return;
        }
        throw new Error("account_deletion_request_failed");
      }
      if (data?.ok !== true) throw new Error("account_deletion_not_confirmed");
      serverConfirmed = true;
      setCompleted(true);
    } catch {
      setError("Não foi possível confirmar a exclusão no servidor. Tente novamente ou procure o suporte.");
    } finally {
      setBusy(false);
    }
    if (serverConfirmed) {
      try {
        await onConfirmed();
      } catch {
        setError("A solicitação foi confirmada no servidor, mas não foi possível sair da conta. Feche o aplicativo e procure o suporte.");
      }
    }
  };

  return (
    <section aria-label="Privacidade e exclusão de conta" className="mb-5 rounded-2xl border border-[#F3D7D9] bg-[#FFF8F8] p-4">
      <h3 className="text-sm font-black text-[#991B1B]">Privacidade da conta</h3>
      <p className="mt-1 text-xs leading-relaxed text-[#6B5556]">
        Você pode solicitar a exclusão da sua conta APOIS Corridas e dos dados pessoais relacionados.
      </p>
      <button
        type="button"
        onClick={() => { setOpen(true); setConfirmation(""); setError(null); }}
        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#DC2626] bg-white px-4 text-sm font-black text-[#B91C1C]"
      >
        <Trash2 size={17} /> Excluir minha conta
      </button>
      {open ? (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="apois-account-deletion-title"
            className="max-h-[95dvh] w-full max-w-[460px] overflow-y-auto rounded-t-[28px] bg-white px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-5 text-[#111827] shadow-2xl sm:rounded-[28px]"
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[#C9141B]">APOIS Corridas</p>
                <h2 id="apois-account-deletion-title" className="mt-1 text-xl font-black">Excluir minha conta</h2>
              </div>
              <button type="button" disabled={busy || completed} onClick={close} aria-label="Cancelar exclusão"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#F3F4F6] disabled:opacity-40">
                <X size={20} />
              </button>
            </header>
            <div className="mt-4 flex gap-3 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm text-[#991B1B]">
              <AlertTriangle size={20} className="mt-0.5 shrink-0" />
              <p>
                A confirmação solicitará a exclusão e encerrará o acesso ao seu perfil de Corridas.
                Alguns registros de corridas e pagamentos poderão ser mantidos quando exigidos por lei,
                segurança ou exercício regular de direitos.
              </p>
            </div>
            <form className="mt-5 space-y-4" onSubmit={(event) => void submit(event)}>
              <label className="block">
                <span className="text-sm font-bold">Para confirmar, digite EXCLUIR</span>
                <input
                  type="text" value={confirmation} disabled={busy || completed}
                  autoCapitalize="characters" autoComplete="off" spellCheck={false}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="mt-2 h-14 w-full rounded-xl border border-[#D1D5DB] bg-white px-4 text-base outline-none focus:border-[#C9141B]"
                  placeholder="EXCLUIR"
                />
              </label>
              {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-[#991B1B]">{error}</p> : null}
              {completed ? <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-[#166534]">Solicitação de exclusão confirmada. Sua sessão será encerrada.</p> : null}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" disabled={busy || completed} onClick={close}
                  className="min-h-12 rounded-xl border border-[#D1D5DB] px-3 font-bold disabled:opacity-40">Cancelar</button>
                <button type="submit" disabled={busy || completed || confirmation.trim() !== "EXCLUIR"}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#B91C1C] px-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : null}
                  {busy ? "Enviando..." : "Confirmar exclusão"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
