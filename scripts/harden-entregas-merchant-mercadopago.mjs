import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = resolve(root, '.work/entregas');

function replaceRequired(relativePath, search, replacement, label) {
  const path = resolve(workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${relativePath}`);
    process.exit(1);
  }
  writeFileSync(path, before.replace(search, replacement));
  console.log(`[OK] ${label}`);
}

const componentPath = resolve(workspace, 'src/components/MerchantMercadoPagoConnection.tsx');
const component = `import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Unplug,
  WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type SafeAccount = {
  providerUserId: string | null;
  email: string | null;
  status: string;
  expiresAt: string | null;
  connectedAt: string | null;
  lastRefreshedAt: string | null;
  lastError: string | null;
};

type ConnectionState = {
  connected: boolean;
  account: SafeAccount | null;
};

const dateLabel = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

export function MerchantMercadoPagoConnection() {
  const [state, setState] = useState<ConnectionState>({ connected: false, account: null });
  const [busy, setBusy] = useState<"status" | "start" | "disconnect" | null>("status");

  const refresh = useCallback(async (interactive = false) => {
    if (interactive) setBusy("status");
    try {
      const { data, error } = await supabase.functions.invoke("merchant-mercadopago-oauth", {
        body: { action: "status" },
      });
      if (error) throw error;
      setState({ connected: Boolean(data?.connected), account: data?.account ?? null });
      if (interactive) toast.success(data?.connected ? "Conexão Mercado Pago atualizada." : "Conta ainda não conectada.");
    } catch {
      if (interactive) toast.error("Não foi possível consultar a conexão com o Mercado Pago.");
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    const onFocus = () => void refresh(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const connect = async () => {
    setBusy("start");
    try {
      const { data, error } = await supabase.functions.invoke("merchant-mercadopago-oauth", {
        body: { action: "start" },
      });
      if (error) throw error;
      const authorizationUrl = typeof data?.authorizationUrl === "string" ? data.authorizationUrl : null;
      if (!authorizationUrl) throw new Error("authorization_url_missing");
      const popup = window.open(authorizationUrl, "apois-mercadopago-oauth", "popup,width=520,height=760");
      if (!popup) window.location.assign(authorizationUrl);
      toast.info("Conclua a autorização na página segura do Mercado Pago.");
    } catch {
      toast.error("Não foi possível iniciar a conexão com o Mercado Pago.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Desconectar o Mercado Pago? Novos pedidos ficarão indisponíveis até uma nova conexão.")) return;
    setBusy("disconnect");
    try {
      const { error } = await supabase.functions.invoke("merchant-mercadopago-oauth", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      setState({ connected: false, account: null });
      toast.success("Mercado Pago desconectado.");
    } catch {
      toast.error("Não foi possível desconectar a conta agora.");
    } finally {
      setBusy(null);
    }
  };

  const connected = state.connected && state.account?.status === "connected";

  return (
    <section className="rounded-3xl border border-primary/30 bg-zinc-950 p-6 text-white shadow-2xl md:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <WalletCards className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Recebimento dos pedidos</p>
            <h2 className="mt-1 text-xl font-black">Mercado Pago do estabelecimento</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
              O PIX da venda é criado diretamente na sua conta Mercado Pago. A APOIS não recebe o valor da venda e não cobra percentual por pedido.
            </p>
          </div>
        </div>
        <div className={connected ? "rounded-full border border-emerald-800/70 bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-300" : "rounded-full border border-amber-800/70 bg-amber-950/30 px-3 py-1.5 text-xs font-bold text-amber-300"}>
          {connected ? "Conectado" : "Não conectado"}
        </div>
      </div>

      {connected ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-900 bg-black p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-600">Conta vinculada</p>
            <p className="mt-1 font-bold">{state.account?.email || (state.account?.providerUserId ? `Mercado Pago #${state.account.providerUserId}` : "Conta Mercado Pago")}</p>
            <p className="mt-1 text-xs text-zinc-500">Conectada em {dateLabel(state.account?.connectedAt)}</p>
          </div>
          <div className="rounded-2xl border border-zinc-900 bg-black p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-600">Segurança</p>
            <div className="mt-1 flex items-center gap-2 font-bold text-emerald-300"><ShieldCheck className="h-4 w-4" /> OAuth protegido</div>
            <p className="mt-1 text-xs text-zinc-500">Tokens ficam criptografados no backend e são renovados automaticamente.</p>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-amber-900/50 bg-amber-950/15 p-4 text-sm leading-6 text-amber-100">
          Conecte sua conta antes de receber novos pedidos. O cliente verá uma mensagem clara e não seguirá para um pagamento sem conta recebedora configurada.
        </div>
      )}

      {state.account?.status === "refresh_required" ? (
        <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-200">
          A autorização precisa ser renovada. Use “Reconectar Mercado Pago”.
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button type="button" onClick={() => void connect()} disabled={busy !== null} className="min-h-12 flex-1">
          {busy === "start" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : connected ? <RefreshCw className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}
          {connected ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}
        </Button>
        <Button type="button" variant="outline" onClick={() => void refresh(true)} disabled={busy !== null} className="min-h-12 border-zinc-800 bg-black">
          {busy === "status" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
          Atualizar status
        </Button>
        {connected ? (
          <Button type="button" variant="outline" onClick={() => void disconnect()} disabled={busy !== null} className="min-h-12 border-red-950 bg-black text-red-300 hover:bg-red-950/30 hover:text-red-200">
            {busy === "disconnect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}
            Desconectar
          </Button>
        ) : null}
      </div>
    </section>
  );
}
`;
writeFileSync(componentPath, component);
console.log('[OK] entregas: painel de conexão Mercado Pago criado na cópia de trabalho');

replaceRequired(
  'src/routes/merchant.tsx',
  'import { MerchantSubscriptionGate } from "@/components/MerchantSubscriptionGate";',
  'import { MerchantSubscriptionGate } from "@/components/MerchantSubscriptionGate";\nimport { MerchantMercadoPagoConnection } from "@/components/MerchantMercadoPagoConnection";',
  'entregas: painel do estabelecimento importa conexão Mercado Pago',
);

replaceRequired(
  'src/routes/merchant.tsx',
  `      {activeTab === "billing" && (\n        <MerchantSubscriptionGate\n          merchant={merchant}\n          subscription={subscription}\n          onRefresh={() => loadAll(true)}\n          onLogout={logout}\n          embedded\n        />\n      )}`,
  `      {activeTab === "billing" && (\n        <div className="space-y-6">\n          <MerchantSubscriptionGate\n            merchant={merchant}\n            subscription={subscription}\n            onRefresh={() => loadAll(true)}\n            onLogout={logout}\n            embedded\n          />\n          <MerchantMercadoPagoConnection />\n        </div>\n      )}`,
  'entregas: mensalidade e conta recebedora ficam no mesmo fluxo do estabelecimento',
);

replaceRequired(
  'src/components/MerchantSubscriptionGate.tsx',
  'Assim que o pagamento for confirmado, o\n            liberação para novos pedidos ocorre automaticamente por um mês.',
  'Assim que o pagamento for confirmado, a\n            liberação para novos pedidos ocorre automaticamente por um mês.',
  'entregas: texto da mensalidade corrigido',
);

replaceRequired(
  'src/routes/checkout.tsx',
  '      if (paymentMethod !== "pix") throw new Error("No momento, apenas PIX está disponível.");\n\n      const fingerprint = checkoutFingerprint({',
  `      if (paymentMethod !== "pix") throw new Error("No momento, apenas PIX está disponível.");\n\n      const { data: paymentReadiness, error: readinessError } = await supabase.functions.invoke(\n        "merchant-payment-readiness",\n        { body: { merchantId: merchant.id } },\n      );\n      if (readinessError) {\n        throw new Error(\n          await getFunctionErrorMessage(readinessError, "Não foi possível validar o recebimento deste estabelecimento."),\n        );\n      }\n      if (!paymentReadiness?.ready) {\n        throw new Error(\n          typeof paymentReadiness?.message === "string"\n            ? paymentReadiness.message\n            : "Este estabelecimento ainda não está pronto para receber pedidos por PIX.",\n        );\n      }\n\n      const fingerprint = checkoutFingerprint({`,
  'entregas: checkout bloqueia antes de criar pedido quando conta recebedora não está pronta',
);

replaceRequired(
  'src/routes/checkout.tsx',
  `      const { data: providerSetting } = await (supabase.rpc as any)("get_order_payment_provider");\n      const configuredProvider =\n        typeof providerSetting === "string" ? providerSetting.trim().toLowerCase() : "mercadopago";\n      const pixFunction =\n        configuredProvider === "asaas" ? "create-asaas-pix-charge" : "create-pix-charge";`,
  '      const pixFunction = "create-merchant-mercadopago-pix";',
  'entregas: Superapp cria PIX diretamente na conta Mercado Pago do estabelecimento',
);

console.log('[OK] entregas: Mercado Pago do estabelecimento aplicado somente na cópia .work');
