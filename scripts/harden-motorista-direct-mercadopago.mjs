import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';
const full = (relative) => resolve(root, workspace, relative);

function patch(relative, transform, label) {
  const path = full(relative);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/components/ApoisDriverBottomNav.tsx', (source) =>
  source.replace(
    '{ to: "/motorista/carteira", label: "Carteira", icon: WalletCards },',
    '{ to: "/motorista/ganhos", label: "Ganhos", icon: WalletCards },',
  ),
  'motorista: navegação inferior troca Carteira por Ganhos',
);

patch('src/components/DriverSideMenu.tsx', (source) => {
  let next = source;
  next = next.replace(/\n\s*\{\n\s*to: "\/motorista\/carteira",\n\s*label: "Carteira",\n\s*description: "Saldo e movimentações",\n\s*icon: Coins,\n\s*\},/m, '');
  next = next.replace('label: "Financeiro",\n    description: "Ganhos e repasses",', 'label: "Ganhos",\n    description: "Histórico de valores recebidos pelas corridas",');
  return next;
}, 'motorista: menu remove Carteira e mantém somente Ganhos');

writeFileSync(full('src/routes/motorista.carteira.tsx'), `import { createFileRoute, useNavigate } from "@tanstack/react-router";\nimport { useEffect } from "react";\n\nexport const Route = createFileRoute("/motorista/carteira")({\n  component: LegacyWalletRedirect,\n  head: () => ({ meta: [{ title: "Ganhos — APOIS Motorista" }] }),\n});\n\nfunction LegacyWalletRedirect() {\n  const navigate = useNavigate();\n  useEffect(() => { void navigate({ to: "/motorista/ganhos", replace: true }); }, [navigate]);\n  return <div className="flex min-h-[100dvh] items-center justify-center bg-[#050607] px-6 text-center text-sm font-semibold text-zinc-400">Abrindo seus ganhos...</div>;\n}\n`, 'utf8');
console.log('[OK] motorista: rota antiga Carteira redireciona para Ganhos');

writeFileSync(full('src/routes/motorista.ganhos.tsx'), `import { createFileRoute, useNavigate } from "@tanstack/react-router";\nimport { useCallback, useEffect, useState } from "react";\nimport { ArrowLeft, CheckCircle2, Loader2, RefreshCw, TrendingUp } from "lucide-react";\nimport { ApoisDriverBottomNav } from "@/components/ApoisDriverBottomNav";\nimport { loadDriverFinancialDashboard, type DriverFinancialDashboard } from "@/lib/driverFinance.mobile";\nimport { loadDriverProfile } from "@/lib/driverProfile";\n\nexport const Route = createFileRoute("/motorista/ganhos")({\n  head: () => ({ meta: [{ title: "Ganhos — APOIS Motorista" }] }),\n  component: DriverEarningsPage,\n});\n\nconst money = (cents: number) => (Number.isFinite(cents) ? (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "R$ 0,00");\n\nfunction DriverEarningsPage() {\n  const navigate = useNavigate();\n  const [dashboard, setDashboard] = useState<DriverFinancialDashboard | null>(null);\n  const [loading, setLoading] = useState(true);\n  const [error, setError] = useState<string | null>(null);\n\n  const load = useCallback(async () => {\n    setLoading(true); setError(null);\n    try {\n      const profile = await loadDriverProfile();\n      if (!profile.ok) {\n        await navigate({ to: profile.reason === "no_session" ? "/motorista/login" : "/motorista/status", replace: true });\n        return;\n      }\n      const to = new Date();\n      const from = new Date(); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0);\n      setDashboard(await loadDriverFinancialDashboard(from, to));\n    } catch (err) {\n      console.error("[APOIS Motorista] ganhos", err);\n      setError("Não foi possível carregar seus ganhos agora.");\n    } finally { setLoading(false); }\n  }, [navigate]);\n\n  useEffect(() => { void load(); }, [load]);\n\n  return <div className="min-h-[100dvh] bg-[#050607] text-white">\n    <header className="sticky top-0 z-30 border-b border-white/5 bg-[#08090A]/95 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur-xl">\n      <div className="mx-auto flex max-w-xl items-center gap-3">\n        <button type="button" onClick={() => void navigate({ to: "/motorista/app" })} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-[#111315]"><ArrowLeft className="h-5 w-5" /></button>\n        <div className="min-w-0 flex-1"><p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#F6BE1C]">Mercado Pago</p><h1 className="text-xl font-black">Meus ganhos</h1></div>\n        <button type="button" onClick={() => void load()} disabled={loading} className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-[#111315] text-[#F6BE1C]"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></button>\n      </div>\n    </header>\n    <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+112px)]">\n      <section className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/8 p-4">\n        <div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" /><div><h2 className="font-black">Recebimento direto</h2><p className="mt-1 text-xs leading-5 text-zinc-400">Os valores das corridas são recebidos diretamente na sua conta Mercado Pago. A APOIS não mantém saldo de saque para corridas.</p></div></div>\n      </section>\n      {loading && !dashboard ? <div className="flex min-h-[42vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#F6BE1C]" /></div> : null}\n      {error ? <section className="rounded-2xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-300">{error}</section> : null}\n      {dashboard ? <>\n        <section className="grid grid-cols-3 gap-2 max-[380px]:grid-cols-1">\n          <Metric label="Hoje" value={money(dashboard.kpis.todayCents)} />\n          <Metric label="7 dias" value={money(dashboard.kpis.last7DaysCents)} />\n          <Metric label="Mês" value={money(dashboard.kpis.monthCents)} />\n        </section>\n        <section className="rounded-[24px] border border-white/8 bg-[#0D0F11] p-4">\n          <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#F6BE1C]" /><h2 className="font-black">Últimas corridas recebidas</h2></div>\n          <div className="mt-4 space-y-3">\n            {dashboard.settlements.length === 0 ? <p className="text-sm text-zinc-500">Nenhuma corrida liquidada neste período.</p> : dashboard.settlements.slice(0, 20).map((item) => <div key={item.settlementId} className="rounded-2xl border border-white/6 bg-black/20 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.destinationName}</p><p className="mt-1 text-xs text-zinc-500">Pix • {item.settlementStatus}</p></div><p className="shrink-0 text-sm font-black text-emerald-400">{money(item.driverEarningCents)}</p></div></div>)}\n          </div>\n        </section>\n      </> : null}\n    </main>\n    <ApoisDriverBottomNav />\n  </div>;\n}\n\nfunction Metric({ label, value }: { label: string; value: string }) {\n  return <div className="rounded-2xl border border-white/8 bg-[#0D0F11] p-3"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;\n}\n`, 'utf8');
console.log('[OK] motorista: Ganhos sem carteira, chave Pix ou solicitação de saque');

console.log(`[OK] fluxo financeiro direto Mercado Pago aplicado em ${workspace}`);
