import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/routes/merchant.tsx');
let source = readFileSync(path, 'utf8');

const startMarker = '      {activeTab === "finance" && (';
const endMarker = '      {activeTab === "settings" && (';

if (!source.includes('Recebimento direto no Mercado Pago')) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0 || end <= start) {
    throw new Error('[FAIL] Entregas: bloco Financeiro do estabelecimento não encontrado.');
  }

  const replacement = `      {activeTab === "finance" && (
        <div className="space-y-6">
          <section className="rounded-3xl border border-primary/30 bg-[radial-gradient(circle_at_top_right,rgba(246,190,28,0.12),transparent_38%),#090909] p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Financeiro</p>
            <h2 className="mt-2 text-2xl font-black">Recebimento direto no Mercado Pago</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
              O valor das vendas é destinado à conta Mercado Pago conectada do estabelecimento. A APOIS não recebe o valor dos pedidos e não cobra percentual sobre as vendas.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <MetricCard
                label="Vendas pagas"
                value={money(
                  orders
                    .filter((order) => order.payment_status === "paid" && !["cancelled", "refunded"].includes(order.status))
                    .reduce((sum, order) => sum + Number(order.merchant_net ?? Math.max(Number(order.subtotal ?? 0) - Number(order.discount ?? 0), 0)), 0),
                )}
              />
              <MetricCard label="Comissão APOIS" value="R$ 0,00" />
              <MetricCard label="Mensalidade" value="R$ 69,90" />
            </div>
          </section>

          <MerchantMercadoPagoConnection />

          <section className="rounded-2xl border border-zinc-900 bg-zinc-950 p-5">
            <h3 className="font-black">Como o recebimento funciona</h3>
            <div className="mt-3 space-y-2 text-sm leading-6 text-zinc-400">
              <p>• O cliente paga o pedido pelo fluxo Mercado Pago vinculado ao estabelecimento.</p>
              <p>• A APOIS não oferece saque manual do valor das vendas.</p>
              <p>• A carteira antiga permanece apenas como registro legado e não representa dinheiro custodiado pela APOIS.</p>
              <p>• A mensalidade do estabelecimento é cobrada separadamente e não altera o valor das vendas.</p>
            </div>
          </section>
        </div>
      )}

`;
  source = source.slice(0, start) + replacement + source.slice(end);
}

for (const marker of [
  'Recebimento direto no Mercado Pago',
  'Comissão APOIS',
  'value="R$ 0,00"',
  'value="R$ 69,90"',
  'A APOIS não oferece saque manual do valor das vendas.',
  'carteira antiga permanece apenas como registro legado',
  '<MerchantMercadoPagoConnection />',
]) {
  if (!source.includes(marker)) {
    throw new Error(`[FAIL] Entregas: Financeiro direto incompleto (${marker}).`);
  }
}

const financeStart = source.indexOf(startMarker);
const settingsStart = source.indexOf(endMarker, financeStart);
const financeBlock = source.slice(financeStart, settingsStart);
for (const forbidden of [
  'Solicitar saque',
  'Salvar chave PIX',
  'Valor do saque',
  'Conta para repasse',
  'onClick={requestPayout}',
  'onClick={savePayoutAccount}',
]) {
  if (financeBlock.includes(forbidden)) {
    throw new Error(`[FAIL] Entregas: controle financeiro legado permaneceu visível (${forbidden}).`);
  }
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: Financeiro do estabelecimento usa recebimento direto Mercado Pago; saque/carteira custodial removidos da UI do Superapp.');
