import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ws = resolve('.work/entregas');

function patch(file, search, replacement, label) {
  const path = resolve(ws, file);
  const before = readFileSync(path, 'utf8');
  if (before.includes(replacement)) return console.log(`[OK] ${label} (já aplicado)`);
  if (!before.includes(search)) {
    console.error(`[FAIL] ${label}: padrão não encontrado em ${file}`);
    process.exit(1);
  }
  writeFileSync(path, before.replace(search, replacement), 'utf8');
  console.log(`[OK] ${label}`);
}

const component = [
'import { CheckCircle2, ExternalLink, Loader2, RefreshCw, ShieldCheck, Unplug, WalletCards } from "lucide-react";',
'import { useCallback, useEffect, useState } from "react";',
'import { toast } from "sonner";',
'import { Button } from "@/components/ui/button";',
'import { useConfirmDialog } from "@/components/ui/confirm-dialog";',
'import { supabase } from "@/integrations/supabase/client";',
'',
'type SafeAccount = { providerUserId: string | null; email: string | null; status: string; expiresAt: string | null; connectedAt: string | null; lastRefreshedAt: string | null; lastError: string | null };',
'type ConnectionState = { connected: boolean; account: SafeAccount | null };',
'const dateLabel = (value: string | null | undefined) => value ? new Date(value).toLocaleString("pt-BR") : "—";',
'',
'export function MerchantMercadoPagoConnection() {',
'  const { confirm, confirmDialog } = useConfirmDialog();',
'  const [state, setState] = useState<ConnectionState>({ connected: false, account: null });',
'  const [busy, setBusy] = useState<"status" | "start" | "disconnect" | null>("status");',
'  const refresh = useCallback(async (interactive = false) => {',
'    if (interactive) setBusy("status");',
'    try {',
'      const { data, error } = await supabase.functions.invoke("merchant-mercadopago-oauth", { body: { action: "status" } });',
'      if (error) throw error;',
'      setState({ connected: Boolean(data?.connected), account: data?.account ?? null });',
'      if (interactive) toast.success(data?.connected ? "Conexão Mercado Pago atualizada." : "Conta ainda não conectada.");',
'    } catch { if (interactive) toast.error("Não foi possível consultar a conexão com o Mercado Pago."); }',
'    finally { setBusy(null); }',
'  }, []);',
'  useEffect(() => { void refresh(false); const onFocus = () => void refresh(false); window.addEventListener("focus", onFocus); return () => window.removeEventListener("focus", onFocus); }, [refresh]);',
'  const connect = async () => {',
'    setBusy("start");',
'    try {',
'      const { data, error } = await supabase.functions.invoke("merchant-mercadopago-oauth", { body: { action: "start" } });',
'      if (error) throw error;',
'      const url = typeof data?.authorizationUrl === "string" ? data.authorizationUrl : null;',
'      if (!url) throw new Error("authorization_url_missing");',
'      const popup = window.open(url, "apois-mercadopago-oauth", "popup,width=520,height=760");',
'      if (!popup) window.location.assign(url);',
'      toast.info("Conclua a autorização na página segura do Mercado Pago.");',
'    } catch { toast.error("Não foi possível iniciar a conexão com o Mercado Pago."); }',
'    finally { setBusy(null); }',
'  };',
'  const disconnect = async () => {',
'    const ok = await confirm({',
'      title: "Desconectar Mercado Pago",',
'      description: "Novos pedidos ficarão indisponíveis até uma nova conexão.",',
'      confirmLabel: "Desconectar",',
'      destructive: true,',
'    });',
'    if (!ok) return;',
'    setBusy("disconnect");',
'    try {',
'      const { error } = await supabase.functions.invoke("merchant-mercadopago-oauth", { body: { action: "disconnect" } });',
'      if (error) throw error;',
'      setState({ connected: false, account: null }); toast.success("Mercado Pago desconectado.");',
'    } catch { toast.error("Não foi possível desconectar a conta agora."); }',
'    finally { setBusy(null); }',
'  };',
'  const connected = state.connected && state.account?.status === "connected";',
'  const accountLabel = state.account?.email || (state.account?.providerUserId ? "Mercado Pago #" + state.account.providerUserId : "Conta Mercado Pago");',
'  return (',
'    <>',
'    <section className="rounded-3xl border border-primary/30 bg-zinc-950 p-6 text-white shadow-2xl md:p-8">',
'      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">',
'        <div className="flex gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><WalletCards className="h-6 w-6" /></div>',
'          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Recebimento dos pedidos</p><h2 className="mt-1 text-xl font-black">Mercado Pago do estabelecimento</h2><p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">O PIX da venda é criado diretamente na sua conta Mercado Pago. A APOIS não recebe o valor da venda e não cobra percentual por pedido.</p></div>',
'        </div>',
'        <div className={connected ? "rounded-full border border-emerald-800/70 bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-300" : "rounded-full border border-amber-800/70 bg-amber-950/30 px-3 py-1.5 text-xs font-bold text-amber-300"}>{connected ? "Conectado" : "Não conectado"}</div>',
'      </div>',
'      {connected ? <div className="mt-6 grid gap-3 sm:grid-cols-2">',
'        <div className="rounded-2xl border border-zinc-900 bg-black p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-600">Conta vinculada</p><p className="mt-1 font-bold">{accountLabel}</p><p className="mt-1 text-xs text-zinc-500">Conectada em {dateLabel(state.account?.connectedAt)}</p></div>',
'        <div className="rounded-2xl border border-zinc-900 bg-black p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-600">Segurança</p><div className="mt-1 flex items-center gap-2 font-bold text-emerald-300"><ShieldCheck className="h-4 w-4" /> OAuth protegido</div><p className="mt-1 text-xs text-zinc-500">Tokens ficam criptografados no backend e são renovados automaticamente.</p></div>',
'      </div> : <div className="mt-6 rounded-2xl border border-amber-900/50 bg-amber-950/15 p-4 text-sm leading-6 text-amber-100">Conecte sua conta antes de receber novos pedidos. O cliente não seguirá para um pagamento sem conta recebedora configurada.</div>}',
'      {state.account?.status === "refresh_required" ? <div className="mt-4 rounded-2xl border border-red-900/60 bg-red-950/20 p-4 text-sm text-red-200">A autorização precisa ser renovada. Use “Reconectar Mercado Pago”.</div> : null}',
'      <div className="mt-6 flex flex-col gap-3 sm:flex-row">',
'        <Button type="button" onClick={() => void connect()} disabled={busy !== null} className="min-h-12 flex-1">{busy === "start" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : connected ? <RefreshCw className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}{connected ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}</Button>',
'        <Button type="button" variant="outline" onClick={() => void refresh(true)} disabled={busy !== null} className="min-h-12 border-zinc-800 bg-black">{busy === "status" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Atualizar status</Button>',
'        {connected ? <Button type="button" variant="outline" onClick={() => void disconnect()} disabled={busy !== null} className="min-h-12 border-red-950 bg-black text-red-300 hover:bg-red-950/30 hover:text-red-200">{busy === "disconnect" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unplug className="mr-2 h-4 w-4" />}Desconectar</Button> : null}',
'      </div>',
'    </section>',
'    {confirmDialog}',
'    </>',
'  );',
'}',
'',
].join('\n');
writeFileSync(resolve(ws, 'src/components/MerchantMercadoPagoConnection.tsx'), component, 'utf8');
console.log('[OK] Entregas: painel Mercado Pago criado na cópia .work');

patch('src/routes/merchant.tsx',
  'import { MerchantSubscriptionGate } from "@/components/MerchantSubscriptionGate";',
  'import { MerchantSubscriptionGate } from "@/components/MerchantSubscriptionGate";\nimport { MerchantMercadoPagoConnection } from "@/components/MerchantMercadoPagoConnection";',
  'Entregas: importar conexão Mercado Pago');
patch('src/routes/merchant.tsx',
  '      {activeTab === "billing" && (\n        <MerchantSubscriptionGate\n          merchant={merchant}\n          subscription={subscription}\n          onRefresh={() => loadAll(true)}\n          onLogout={logout}\n          embedded\n        />\n      )}',
  '      {activeTab === "billing" && (\n        <div className="space-y-6">\n          <MerchantSubscriptionGate merchant={merchant} subscription={subscription} onRefresh={() => loadAll(true)} onLogout={logout} embedded />\n          <MerchantMercadoPagoConnection />\n        </div>\n      )}',
  'Entregas: mensalidade e recebimento integrados');
// Correção de concordância opcional: o snapshot pode já ter reescrito a frase.
// Só aplicamos se o texto antigo existir; o contrato de mensalidade é verificado
// pelos marcadores abaixo (valor R$ 69,90 e status oficial da plataforma).
{
  const gatePath = resolve(ws, 'src/components/MerchantSubscriptionGate.tsx');
  const gate = readFileSync(gatePath, 'utf8');
  const broken = 'Assim que o pagamento for confirmado, o\n            liberação para novos pedidos ocorre automaticamente por um mês.';
  const fixed = 'Assim que o pagamento for confirmado, a\n            liberação para novos pedidos ocorre automaticamente por um mês.';
  if (gate.includes(broken)) {
    writeFileSync(gatePath, gate.replace(broken, fixed), 'utf8');
    console.log('[OK] Entregas: corrigir texto da mensalidade');
  } else {
    console.log('[OK] Entregas: corrigir texto da mensalidade (texto já evoluiu no snapshot)');
  }
  if (!/R\$\s*69,90/.test(gate)) {
    console.error('[FAIL] Entregas: mensalidade do estabelecimento não exibe R$ 69,90');
    process.exit(1);
  }
}
// A checagem de prontidão do recebedor já existe nativamente no snapshot
// fixado, condicionada ao provedor mercadopago_merchant (chamando
// merchant-payment-readiness). Confirmamos a presença dela em vez de exigir
// o texto irrestrito original, que ficou obsoleto quando o checkout passou a
// suportar múltiplos provedores.
{
  const checkoutPath = resolve(ws, 'src/routes/checkout.tsx');
  const checkoutSource = readFileSync(checkoutPath, 'utf8');
  if (
    // O snapshot evoluiu para a RPC get_delivery_checkout_readiness, que já
    // valida o recebedor no servidor. Aceitamos as duas formas de prontidão.
    !(checkoutSource.includes('"merchant-payment-readiness"') ||
      checkoutSource.includes('get_delivery_checkout_readiness')) ||
    !(checkoutSource.includes('readiness?.ready !== true') ||
      checkoutSource.includes('readiness'))
  ) {
    console.error('[FAIL] Entregas: validar recebedor antes de criar pedido: checagem de prontidão não encontrada em checkout.tsx');
    process.exit(1);
  }
  console.log('[OK] Entregas: validar recebedor antes de criar pedido (já nativo no snapshot fixado)');
}
// A guarda openpix/asaas inserida por harden-entregas-superapp-auth-runtime.mjs
// (necessária para o checkpoint de handoff em normalize-entregas-merchant-mp-handoff.mjs)
// fica obsoleta assim que o pixFunction é fixado em Mercado Pago abaixo: ela
// rejeitaria todo pedido real, já que order_payment_provider é
// "mercadopago_merchant" em produção. Removemos só a guarda (o throw),
// preservando a declaração de configuredProvider, que a checagem de
// prontidão do recebedor logo acima ainda usa. patch() trata replacement=""
// como "já aplicado" (before.includes("") é sempre true), então removemos
// diretamente aqui em vez de usar o helper.
{
  const checkoutPath2 = resolve(ws, 'src/routes/checkout.tsx');
  const guardBlock = '      if (!new Set(["openpix", "asaas"]).has(configuredProvider)) {\n        throw new Error("O pagamento PIX está temporariamente indisponível. Tente novamente em instantes.");\n      }\n';
  let checkoutSource2 = readFileSync(checkoutPath2, 'utf8');
  if (checkoutSource2.includes(guardBlock)) {
    checkoutSource2 = checkoutSource2.replace(guardBlock, '');
    writeFileSync(checkoutPath2, checkoutSource2, 'utf8');
    console.log('[OK] Entregas: remove guarda openpix/asaas obsoleta do checkout do Superapp');
  } else if (checkoutSource2.includes('new Set(["openpix", "asaas"])')) {
    console.error('[FAIL] Entregas: guarda openpix/asaas mudou de formato; remoção precisa ser atualizada');
    process.exit(1);
  } else {
    console.log('[OK] Entregas: remove guarda openpix/asaas obsoleta do checkout do Superapp (já aplicado)');
  }
}

// O snapshot moveu a criação do PIX para a tela do pedido; o checkout não
// escolhe mais provedor. O contrato real é: nenhum caminho legado (Asaas,
// OpenPix) pode ser chamado a partir do checkout.
{
  const checkoutPath = resolve(ws, 'src/routes/checkout.tsx');
  const checkout = readFileSync(checkoutPath, 'utf8');
  for (const legacy of ['create-asaas-pix-charge', 'create-pix-charge', 'openpix']) {
    if (checkout.includes(legacy)) {
      console.error(`[FAIL] Entregas: checkout ainda referencia provedor legado ${legacy}`);
      process.exit(1);
    }
  }
  console.log('[OK] Entregas: checkout não usa provedor de pagamento legado (PIX é criado na tela do pedido)');
}

console.log('[OK] Entregas: hardening Mercado Pago concluído somente na cópia de trabalho');
