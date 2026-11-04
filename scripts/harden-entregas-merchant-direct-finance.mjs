import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const merchantPath = resolve('.work/entregas/src/routes/merchant.tsx');
let source = readFileSync(merchantPath, 'utf8');

source = source
  .replace('import { clearPayoutAttemptKey, getPayoutAttemptKey } from "@/lib/payout-attempt";\n', '')
  .replace('import { MerchantMercadoPagoConnectCard } from "@/components/MerchantMercadoPagoConnectCard";\n', '')
  .replace('import { MerchantMercadoPagoConnection } from "@/components/MerchantMercadoPagoConnection";\n', '')
  .replaceAll('          <MerchantMercadoPagoConnectCard />\n\n', '')
  .replaceAll('          <MerchantMercadoPagoConnection />\n\n', '');

// Remove o runtime de saque/OpenPix do componente, não apenas seus botões.
const payoutRuntimeStart = source.indexOf('  const savePayoutAccount = async () => {');
const pendingOrdersStart = source.indexOf('  const pendingOrders = useMemo(', payoutRuntimeStart);
if (payoutRuntimeStart >= 0 && pendingOrdersStart > payoutRuntimeStart) {
  source = source.slice(0, payoutRuntimeStart) + source.slice(pendingOrdersStart);
}

// Métricas deixam de chamar cash/pending de "pago" e passam a representar valor
// registrado de pedidos válidos, sem inferir liquidação eletrônica.
const paidRevenueBlock = `  const paidRevenue = useMemo(\n    () =>\n      orders\n        .filter((order) => order.payment_status === "paid")\n        .reduce((sum, order) => sum + Number(order.total || 0), 0),\n    [orders],\n  );`;
const recordedValueBlock = `  const recordedOrderValue = useMemo(\n    () =>\n      orders\n        .filter((order) => !["cancelled", "refunded"].includes(order.status))\n        .reduce((sum, order) => sum + Number(order.total || 0), 0),\n    [orders],\n  );`;
if (source.includes(paidRevenueBlock)) source = source.replace(paidRevenueBlock, recordedValueBlock);
source = source
  .replace('<MetricCard\n              label="Vendas pagas"\n              value={money(paidRevenue)}\n              hint="Total bruto dos pedidos carregados"\n            />', '<MetricCard\n              label="Valor dos pedidos"\n              value={money(recordedOrderValue)}\n              hint="Total registrado, sem confirmação eletrônica de pagamento"\n            />')
  .replace('description: "Informe o motivo do cancelamento para o cliente e o estorno.",', 'description: "Informe o motivo do cancelamento para o cliente.",')
  .replace('<DialogDescription>Informe o motivo do cancelamento para o cliente e o estorno.</DialogDescription>', '<DialogDescription>Informe o motivo do cancelamento para o cliente.</DialogDescription>');

const reportPaidBlock = `          const paid = monthOrders.filter(\n            (order) =>\n              order.payment_status === "paid" && !["cancelled", "refunded"].includes(order.status),\n          );\n          const gross = paid.reduce((sum, order) => sum + Number(order.total ?? 0), 0);\n          const ticket = paid.length > 0 ? gross / paid.length : 0;\n          const deliveryFees = paid.reduce(\n            (sum, order) => sum + Number(order.delivery_fee ?? 0),\n            0,\n          );`;
const reportDirectBlock = `          const validOrders = monthOrders.filter(\n            (order) => !["cancelled", "refunded"].includes(order.status),\n          );\n          const gross = validOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);\n          const ticket = validOrders.length > 0 ? gross / validOrders.length : 0;\n          const deliveryFees = validOrders.reduce(\n            (sum, order) => sum + Number(order.delivery_fee ?? 0),\n            0,\n          );`;
if (source.includes(reportPaidBlock)) source = source.replace(reportPaidBlock, reportDirectBlock);
source = source
  .replace('<MetricCard label="Vendas pagas" value={money(gross)} />', '<MetricCard label="Valor registrado" value={money(gross)} />')
  .replace('Somatório das taxas em pedidos pagos e válidos.', 'Somatório das taxas em pedidos válidos do período.');

const startMarker = '      {activeTab === "finance" && (';
const endMarker = '      {activeTab === "courier-payouts" && (';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) {
  throw new Error('[FAIL] Entregas: bloco Financeiro do estabelecimento não encontrado.');
}

const replacement = `      {activeTab === "finance" && (\n        <div className="space-y-6">\n          <section className="rounded-3xl border border-primary/30 bg-[radial-gradient(circle_at_top_right,rgba(246,190,28,0.12),transparent_38%),#090909] p-6">\n            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Financeiro</p>\n            <h2 className="mt-2 text-2xl font-black">Pagamento direto ao estabelecimento</h2>\n            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">\n              A APOIS não processa, recebe nem custodia o valor dos pedidos nesta fase. O cliente realiza o pagamento diretamente ao estabelecimento; por isso um pedido cash/pending continua operacional sem ser marcado como pagamento eletrônico aprovado.\n            </p>\n            <div className="mt-5 grid gap-3 sm:grid-cols-3">\n              <MetricCard label="Pedidos registrados" value={orders.length} />\n              <MetricCard label="Valor registrado" value={money(recordedOrderValue)} />\n              <MetricCard label="Mensalidade" value="R$ 69,90" />\n            </div>\n          </section>\n\n          <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">\n            <h3 className="font-black">Como funciona nesta fase</h3>\n            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">\n              <p>• O pagamento do pedido ocorre diretamente entre cliente e estabelecimento.</p>\n              <p>• A APOIS não confirma eletronicamente esse pagamento e não transforma cash/pending em paid.</p>\n              <p>• Não há saque de vendas, carteira custodial ou conexão com gateway eletrônico neste fluxo.</p>\n              <p>• Repasses de entrega ficam na aba Repasses e seguem o modelo merchant_manual: o estabelecimento paga o entregador diretamente.</p>\n            </div>\n          </section>\n        </div>\n      )}\n\n`;
source = source.slice(0, start) + replacement + source.slice(end);

for (const forbidden of [
  'openpix-payout',
  'request_payout',
  'getPayoutAttemptKey',
  'clearPayoutAttemptKey',
  'MerchantMercadoPagoConnectCard',
  'MerchantMercadoPagoConnection',
  'Recebimento direto no Mercado Pago',
  'O cliente paga o pedido pelo fluxo Mercado Pago',
  'Solicitar saque',
  'Salvar chave PIX',
  'Valor do saque',
  'Conta para repasse',
]) {
  if (source.includes(forbidden)) {
    throw new Error(`[FAIL] Entregas: runtime/controle financeiro legado permaneceu no merchant (${forbidden}).`);
  }
}
for (const marker of [
  'Pagamento direto ao estabelecimento',
  'A APOIS não processa, recebe nem custodia o valor dos pedidos',
  'cash/pending continua operacional',
  'merchant_manual',
  'const recordedOrderValue = useMemo(',
  'label="Valor registrado"',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregas: financeiro direto incompleto (${marker}).`);
}

writeFileSync(merchantPath, source, 'utf8');
console.log('[OK] Entregas: Financeiro do estabelecimento sem Mercado Pago/OpenPix/saque e sem chamar cash/pending de pago.');

// Mensalidade: preserva leitura do status oficial, mas não oferece gateway ou PIX
// enquanto nenhum provedor eletrônico está homologado para este produto.
const subscriptionPath = resolve('.work/entregas/src/components/MerchantSubscriptionGate.tsx');
const subscriptionSource = `import { LogOut, RefreshCw, ShieldAlert } from "lucide-react";\nimport { useState } from "react";\nimport { Button } from "@/components/ui/button";\n\ntype MerchantSubscriptionGateProps = {\n  merchant: any;\n  subscription: any;\n  onRefresh: () => void | Promise<void>;\n  onLogout: () => void | Promise<void>;\n  embedded?: boolean;\n};\n\nconst dateLabel = (value: string | null | undefined) =>\n  value ? new Date(value).toLocaleString("pt-BR") : "—";\n\nfunction statusLabel(value: string | null | undefined) {\n  switch (value) {\n    case "paid":\n    case "authorized":\n      return "Mensalidade ativa";\n    case "pending":\n      return "Regularização pendente";\n    case "paused":\n      return "Mensalidade pausada";\n    case "cancelled":\n    case "canceled":\n      return "Mensalidade cancelada";\n    default:\n      return value ? \`Status: \${value}\` : "Mensalidade ainda não ativada";\n  }\n}\n\nexport function MerchantSubscriptionGate({ merchant, subscription, onRefresh, onLogout, embedded = false }: MerchantSubscriptionGateProps) {\n  const [refreshing, setRefreshing] = useState(false);\n  const refresh = async () => {\n    if (refreshing) return;\n    setRefreshing(true);\n    try { await onRefresh(); } finally { setRefreshing(false); }\n  };\n\n  return (\n    <div className={embedded ? "text-white" : "min-h-dvh bg-black px-4 py-8 text-white"}>\n      <div className="mx-auto max-w-2xl">\n        {!embedded ? (\n          <div className="mb-5 flex items-center justify-between gap-3">\n            <div><p className="text-xs font-black uppercase tracking-[0.24em] text-primary">APOIS ENTREGA</p><h1 className="mt-1 text-2xl font-black">{merchant?.name ?? "Estabelecimento"}</h1></div>\n            <Button type="button" variant="outline" onClick={() => void onLogout()} className="border-zinc-800 bg-zinc-950"><LogOut className="mr-2 h-4 w-4" /> Sair</Button>\n          </div>\n        ) : null}\n\n        <section className="rounded-3xl border border-primary/30 bg-zinc-950 p-6 shadow-2xl md:p-8">\n          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><ShieldAlert className="h-6 w-6" /></div>\n          <h2 className="mt-5 text-2xl font-black">Mensalidade do estabelecimento</h2>\n          <p className="mt-2 text-sm leading-6 text-zinc-400">A mensalidade é de <strong className="text-white">R$ 69,90 por mês</strong>. O status abaixo é o registro oficial da plataforma.</p>\n\n          <div className="mt-6 grid gap-3 sm:grid-cols-2">\n            <div className="rounded-2xl border border-zinc-900 bg-black p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-600">Situação</p><p className="mt-1 font-black text-amber-400">{statusLabel(subscription?.provider_status)}</p></div>\n            <div className="rounded-2xl border border-zinc-900 bg-black p-4"><p className="text-xs font-bold uppercase tracking-wider text-zinc-600">Acesso até</p><p className="mt-1 font-black">{dateLabel(subscription?.current_period_end)}</p></div>\n          </div>\n\n          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">\n            Pagamento eletrônico temporariamente indisponível. Nenhum gateway de cobrança está ativo neste painel. A APOIS não vai gerar PIX, cartão ou débito automaticamente enquanto um meio de pagamento não estiver homologado e habilitado.\n          </div>\n\n          <Button type="button" variant="outline" onClick={() => void refresh()} disabled={refreshing} className="mt-4 w-full border-zinc-800 bg-black">\n            <RefreshCw className={\`mr-2 h-4 w-4 \${refreshing ? "animate-spin" : ""}\`} /> Atualizar status\n          </Button>\n        </section>\n      </div>\n    </div>\n  );\n}\n`;
for (const forbidden of ['merchant-subscription', 'Mercado Pago', 'qrCodeText', 'QrCode', 'PIX da mensalidade', 'checkout()']) {
  if (subscriptionSource.includes(forbidden)) throw new Error(`[FAIL] Entregas: mensalidade ainda contém gateway (${forbidden}).`);
}
writeFileSync(subscriptionPath, subscriptionSource, 'utf8');
console.log('[OK] Entregas: mensalidade do estabelecimento preserva status oficial sem oferecer gateway eletrônico.');
