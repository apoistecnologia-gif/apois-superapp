import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/motorista';
const path = resolve(root, workspace, 'src/routes/motorista.assinatura.tsx');
const before = readFileSync(path, 'utf8');

for (const marker of [
  'createFileRoute("/motorista/assinatura")',
  '.eq("auth_user_id", auth.user.id)',
  '.eq("user_id", profile.id)',
  'APOIS_MONTHLY_FEE_BRL',
]) {
  if (!before.includes(marker)) {
    throw new Error(`[FAIL] motorista: contrato da mensalidade mudou antes do boundary (${marker})`);
  }
}

const source = `import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Crown, LifeBuoy, RefreshCw, ShieldCheck, Sparkles, Star } from "lucide-react";
import { SettingsPageShell } from "@/components/settings";
import { DSButton, DSCard, Loading } from "@/design-system";
import { supabase } from "@/integrations/supabase/client";
import { APOIS_MONTHLY_FEE_BRL } from "@/lib/payments/types";
import { formatCurrency } from "@/lib/finance/financeSettings";
import { MovviLogo } from "@/components/MovviLogo";

export const Route = createFileRoute("/motorista/assinatura")({
  head: () => ({ meta: [{ title: "Mensalidade — Motorista APOIS" }] }),
  component: DriverSubscriptionPage,
});

type DriverInfo = {
  approval_status: string;
  subscription_status: string;
};

const BENEFITS = [
  "Corridas ilimitadas na plataforma",
  "100% do valor da corrida para o motorista",
  "Sem taxa por corrida da APOIS",
  "Suporte durante a operação",
];

function normalizeStatus(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function DriverSubscriptionPage() {
  const navigate = useNavigate();
  const refreshRequestRef = useRef(0);
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const requestId = ++refreshRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        await navigate({ to: "/motorista/login", replace: true });
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id")
        .eq("auth_user_id", auth.user.id)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile) throw new Error("profile_missing");

      const { data, error: driverError } = await supabase
        .from("drivers")
        .select("approval_status,subscription_status")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (driverError) throw driverError;
      if (requestId !== refreshRequestRef.current) return;
      if (!data) {
        setDriver(null);
        setError("Seu cadastro de motorista ainda não está disponível para consultar a mensalidade.");
        return;
      }
      setDriver(data);
    } catch (caughtError) {
      console.error("[APOIS Driver Subscription] refresh failed", caughtError);
      if (requestId === refreshRequestRef.current) {
        setError("Não foi possível carregar a mensalidade agora.");
      }
    } finally {
      if (requestId === refreshRequestRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  if (loading && !driver) {
    return (
      <SettingsPageShell variant="driver">
        <Loading label="Carregando mensalidade…" />
      </SettingsPageShell>
    );
  }

  const approval = normalizeStatus(driver?.approval_status || "pendente");
  const subscription = normalizeStatus(driver?.subscription_status || "inactive");
  const approved = ["aprovado", "aprovada", "approved"].includes(approval);
  const paidActive = ["active", "ativa", "ativo", "paid", "pago"].includes(subscription);
  const homologation = subscription === "teste";
  const operational = paidActive || homologation;

  return (
    <SettingsPageShell variant="driver">
      <div className="min-w-0 space-y-4 pb-4">
        {error ? (
          <DSCard className="min-w-0 border-red-500/20 bg-red-500/8 p-4" role="alert" aria-live="assertive">
            <div className="flex min-w-0 items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
              <p className="min-w-0 flex-1 break-words text-xs font-bold leading-5 text-red-200">{error}</p>
            </div>
            <button type="button" onClick={() => void refresh()} disabled={loading} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-300/20 px-4 text-xs font-black text-red-100 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
              <RefreshCw className={loading ? "h-4 w-4 animate-spin motion-reduce:animate-none" : "h-4 w-4"} aria-hidden="true" />
              Tentar novamente
            </button>
          </DSCard>
        ) : null}

        <section className="relative min-w-0 overflow-hidden rounded-[28px] border border-[#F6BE1C]/18 bg-[#080A0C] px-4 pb-5 pt-5 text-center shadow-[0_24px_70px_-42px_rgba(246,190,28,.65)] sm:px-5">
          <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_50%_0%,rgba(246,190,28,.18),transparent_68%)]" />
          <div className="relative flex justify-center"><MovviLogo size={66} showTagline productLabel="" /></div>
          <div className={\`relative mx-auto mt-4 flex h-16 w-16 items-center justify-center rounded-full border \${approved ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400" : "border-[#F6BE1C]/30 bg-[#F6BE1C]/10 text-[#F6BE1C]"}\`} aria-hidden="true">
            {approved ? <CheckCircle2 className="h-8 w-8" /> : <Crown className="h-8 w-8" />}
          </div>
          <p className="relative mt-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#F6BE1C]">{approved ? "Cadastro aprovado" : "Plano Motorista APOIS"}</p>
          <h1 className="relative mt-1 text-[clamp(21px,7vw,25px)] font-black leading-tight tracking-[-0.03em] text-white">Mensalidade do motorista</h1>
          <div className="relative mt-4 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-white/8 bg-black/35 px-3 py-1.5 text-center text-[11px] font-black text-zinc-300" role="status">
            <span className={\`h-2 w-2 shrink-0 rounded-full \${operational ? "bg-emerald-400" : "bg-zinc-600"}\`} aria-hidden="true" />
            <span>{paidActive ? "Mensalidade ativa" : homologation ? "Homologação ativa" : "Mensalidade inativa"}</span>
          </div>
        </section>

        <DSCard className="min-w-0 overflow-hidden border-white/8 bg-[#0D0F11] p-0">
          <div className="flex min-w-0 items-start justify-between gap-3 px-4 pb-4 pt-5 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">Plano Motorista Parceiro</p>
              <p className="mt-1 text-[13px] font-semibold leading-5 text-zinc-400">Acesso conforme o status oficial da conta.</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#F6BE1C]/20 bg-[#F6BE1C]/10 text-[#F6BE1C]" aria-hidden="true"><Star className="h-5 w-5" /></div>
          </div>
          <div className="border-y border-white/6 bg-black/25 px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Mensalidade</span>
              <div className="text-right"><span className="text-[clamp(24px,8.5vw,30px)] font-black tracking-[-0.04em] text-[#F6BE1C]">{formatCurrency(APOIS_MONTHLY_FEE_BRL)}</span><span className="ml-1 text-xs font-semibold text-zinc-500">/ mês</span></div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-4 max-[339px]:grid-cols-1">
            {BENEFITS.map((benefit) => (
              <div key={benefit} className="flex min-h-16 min-w-0 items-start gap-2 rounded-2xl border border-white/6 bg-[#111315] px-3 py-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#F6BE1C]" aria-hidden="true" />
                <span className="min-w-0 break-words text-[11px] font-semibold leading-4 text-zinc-300">{benefit}</span>
              </div>
            ))}
          </div>
        </DSCard>

        {!approved ? (
          <DSCard className="min-w-0 border-white/8 bg-[#0D0F11] p-5">
            <p className="text-sm font-black text-white">Aguardando aprovação</p>
            <p className="mt-2 text-xs leading-5 text-zinc-500">Seu cadastro precisa ser aprovado antes da liberação da mensalidade.</p>
          </DSCard>
        ) : paidActive ? (
          <DSCard className="min-w-0 border-emerald-400/20 bg-emerald-400/8 p-5">
            <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /><div><p className="text-sm font-black text-white">Mensalidade ativa</p><p className="mt-2 text-xs leading-5 text-zinc-400">Seu plano está ativo conforme o registro da plataforma.</p></div></div>
          </DSCard>
        ) : homologation ? (
          <DSCard className="min-w-0 border-[#F6BE1C]/20 bg-[#F6BE1C]/8 p-5">
            <div className="flex items-start gap-3"><Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#F6BE1C]" /><div><p className="text-sm font-black text-white">Homologação ativa</p><p className="mt-2 text-xs leading-5 text-zinc-400">Seu acesso de homologação está liberado. Nenhuma cobrança é criada nesta condição.</p></div></div>
          </DSCard>
        ) : (
          <DSCard className="min-w-0 border-[#F6BE1C]/20 bg-[#0D0F11] p-5" role="status">
            <p className="text-sm font-black text-white">Pagamento eletrônico temporariamente indisponível</p>
            <p className="mt-2 text-xs leading-5 text-zinc-400">Nenhum gateway de cobrança está ativo para a mensalidade neste aplicativo. A APOIS não iniciará Pix, cartão ou débito automaticamente. Quando um meio de pagamento for homologado, ele será informado na própria plataforma.</p>
          </DSCard>
        )}

        <DSCard className="flex min-w-0 flex-wrap items-center justify-between gap-3 border-white/8 bg-[#0D0F11] p-4">
          <div className="flex min-w-[180px] flex-1 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/5 text-[#F6BE1C]" aria-hidden="true"><LifeBuoy className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-black text-white">Precisa de ajuda?</p><p className="mt-0.5 text-[11px] leading-4 text-zinc-500">Fale com nossa equipe sobre sua conta.</p></div></div>
          <DSButton variant="outline" size="sm" className="min-h-11 max-[339px]:w-full focus-visible:ring-2 focus-visible:ring-[#F6BE1C]" asChild><Link to="/motorista/suporte">Suporte</Link></DSButton>
        </DSCard>
      </div>
    </SettingsPageShell>
  );
}
`;

for (const forbidden of [
  'asaas-create-driver-membership',
  'driver-membership-checkout',
  'mercadopago',
  'Mercado Pago',
  'openpix',
  'pagbank',
  'generateMembershipPix',
  'pixPayload',
  'QrCode',
]) {
  if (source.toLowerCase().includes(forbidden.toLowerCase())) {
    throw new Error(`[FAIL] motorista: gateway legado permaneceu no boundary (${forbidden})`);
  }
}

for (const required of [
  '.eq("auth_user_id", auth.user.id)',
  '.eq("user_id", profile.id)',
  'Pagamento eletrônico temporariamente indisponível',
  'Nenhum gateway de cobrança está ativo',
  'Nenhuma cobrança é criada nesta condição.',
]) {
  if (!source.includes(required)) throw new Error(`[FAIL] motorista: boundary financeiro incompleto (${required})`);
}

writeFileSync(path, source, 'utf8');
console.log(`[OK] motorista: mensalidade sem gateway descontinuado em ${workspace}`);
