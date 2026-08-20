import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function replaceRequired(path, search, replacement, label) {
  const full = resolve(root, path);
  const before = readFileSync(full, 'utf8');
  if (before.includes(replacement)) {
    console.log(`[OK] ${label} (já aplicado)`);
    return;
  }
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão esperado não encontrado em ${path}`);
    process.exit(1);
  }
  writeFileSync(full, before.replace(search, replacement));
  console.log(`[OK] ${label}`);
}

replaceRequired(
  '.work/motorista/src/integrations/supabase/client.ts',
  "      storage: typeof window !== 'undefined' ? localStorage : undefined,\n      persistSession: true,",
  "      storage: typeof window !== 'undefined' ? localStorage : undefined,\n      storageKey: 'apois-superapp-motorista-auth-v1',\n      persistSession: true,",
  'motorista: sessão Supabase isolada dentro do Superapp',
);

replaceRequired(
  '.work/motorista/src/mobile.tsx',
  'import { createRouter, RouterProvider } from "@tanstack/react-router";',
  'import { createHashHistory, createRouter, RouterProvider } from "@tanstack/react-router";',
  'motorista: importar Hash History para execução embutida',
);

replaceRequired(
  '.work/motorista/src/mobile.tsx',
  '  const router = createRouter({\n    // eslint-disable-next-line @typescript-eslint/no-explicit-any\n    routeTree: routeTree as any,',
  '  const router = createRouter({\n    history: createHashHistory(),\n    // eslint-disable-next-line @typescript-eslint/no-explicit-any\n    routeTree: routeTree as any,',
  'motorista: usar Hash History dentro do Superapp',
);

replaceRequired(
  '.work/motorista/vite.mobile.config.ts',
  '  return {\n    appType: "spa",',
  '  return {\n    base: "./",\n    appType: "spa",',
  'motorista: assets relativos ao módulo do Superapp',
);

replaceRequired(
  '.work/motorista/src/routes/motorista.assinatura.tsx',
  'import { MovviLogo } from "@/components/MovviLogo";',
  'import { MovviLogo } from "@/components/MovviLogo";\nimport { MercadoPagoSellerCard } from "@/components/payments/MercadoPagoSellerCard";',
  'motorista: mensalidade importa conexão Mercado Pago',
);

replaceRequired(
  '.work/motorista/src/routes/motorista.assinatura.tsx',
  '        "asaas-create-driver-membership",',
  '        "driver-membership-checkout",',
  'motorista: mensalidade usa roteador de provedor',
);

replaceRequired(
  '.work/motorista/src/routes/motorista.assinatura.tsx',
  '        <DSCard className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-white/8 bg-[#0D0F11] p-4">',
  '        <MercadoPagoSellerCard />\n\n        <DSCard className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-white/8 bg-[#0D0F11] p-4">',
  'motorista: exibir vínculo Mercado Pago antes do suporte',
);

const componentPath = resolve(root, '.work/motorista/src/components/payments/MercadoPagoSellerCard.tsx');
mkdirSync(dirname(componentPath), { recursive: true });
writeFileSync(componentPath, `import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type SellerStatus = {
  ok?: boolean;
  connected?: boolean;
  status?: string;
  mercadopagoUserId?: string | null;
  liveMode?: boolean;
  connectedAt?: string | null;
  tokenExpiresAt?: string | null;
  lastError?: string | null;
  error?: string;
};

type OAuthStart = {
  authorizationUrl?: string;
  expiresAt?: string;
  error?: string;
};

function dateLabel(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(parsed);
}

export function MercadoPagoSellerCard() {
  const [status, setStatus] = useState<SellerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<SellerStatus>("mercadopago-driver-status", { body: {} });
      if (error) throw error;
      setStatus(data ?? null);
    } catch (error) {
      console.error("[MercadoPagoSellerCard] status failed", error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [refresh]);

  async function connect() {
    if (connecting) return;
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke<OAuthStart>("mercadopago-oauth-start", { body: {} });
      if (error) throw error;
      if (!data?.authorizationUrl) {
        if (data?.error === "mercadopago_configuration_missing") throw new Error("configuration_missing");
        throw new Error(data?.error || "oauth_url_missing");
      }

      const browser = (window as unknown as { Capacitor?: { Plugins?: { Browser?: { open?: (options: { url: string }) => Promise<unknown> } } } }).Capacitor?.Plugins?.Browser;
      if (browser?.open) {
        await browser.open({ url: data.authorizationUrl });
      } else {
        window.open(data.authorizationUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      console.error("[MercadoPagoSellerCard] connect failed", error);
      const message = error instanceof Error && error.message.includes("configuration_missing")
        ? "O Mercado Pago ainda aguarda as credenciais de produção da APOIS."
        : "Não foi possível iniciar a conexão com o Mercado Pago agora.";
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  }

  const connected = status?.connected === true;
  const connectedAt = dateLabel(status?.connectedAt);

  return (
    <section className="min-w-0 rounded-[24px] border border-white/8 bg-[#0D0F11] p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <div className={\`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border \${connected ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-400" : "border-[#F6BE1C]/20 bg-[#F6BE1C]/10 text-[#F6BE1C]"}\`}>
          {connected ? <CheckCircle2 className="h-5 w-5" /> : <WalletCards className="h-5 w-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#F6BE1C]">Recebimento das corridas</p>
          <h2 className="mt-1 break-words text-base font-black text-white">Mercado Pago</h2>
          <p className="mt-1 break-words text-xs leading-5 text-zinc-500">
            {connected
              ? "Sua conta está conectada. Os pagamentos Pix das corridas poderão ser feitos diretamente para sua conta."
              : "Conecte sua conta Mercado Pago para receber o valor das corridas diretamente, sem o dinheiro passar pela conta da APOIS."}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/8 bg-black/25 text-xs font-bold text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Consultando vínculo…
        </div>
      ) : connected ? (
        <div className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/8 p-3">
          <div className="flex items-center gap-2 text-xs font-black text-emerald-300"><ShieldCheck className="h-4 w-4" /> Conta conectada</div>
          {connectedAt ? <p className="mt-1 text-[11px] text-zinc-500">Conectada em {connectedAt}</p> : null}
          {status?.mercadopagoUserId ? <p className="mt-1 break-all text-[10px] text-zinc-600">Conta Mercado Pago: {status.mercadopagoUserId}</p> : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={connecting}
          onClick={() => void connect()}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#F6BE1C] px-4 text-sm font-black text-black disabled:opacity-60"
        >
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
          {connecting ? "Abrindo Mercado Pago…" : "Conectar Mercado Pago"}
        </button>
      )}

      <button type="button" onClick={() => void refresh()} disabled={loading} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] text-[11px] font-black text-zinc-400 disabled:opacity-50">
        <RefreshCw className={\`h-3.5 w-3.5 \${loading ? "animate-spin" : ""}\`} /> Atualizar status
      </button>
    </section>
  );
}
`, 'utf8');
console.log('[OK] motorista: cartão Mercado Pago criado somente em .work');
