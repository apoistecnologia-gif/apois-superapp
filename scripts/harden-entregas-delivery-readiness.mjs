import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve('.work/entregas/src/routes/checkout.tsx');
let source = readFileSync(path, 'utf8');

const stateAnchor = '  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);';
if (!source.includes('const [deliveryFinancialReady, setDeliveryFinancialReady]')) {
  if (!source.includes(stateAnchor)) throw new Error('[FAIL] Entregas: estado da cotação de entrega não encontrado.');
  source = source.replace(
    stateAnchor,
    `${stateAnchor}\n  const [deliveryFinancialReady, setDeliveryFinancialReady] = useState(false);\n  const [deliveryFinancialLoading, setDeliveryFinancialLoading] = useState(true);\n  const [deliveryFinancialMessage, setDeliveryFinancialMessage] = useState<string | null>(null);`,
  );
}

const configEffectEnd = `  }, [merchant?.id]);

  useEffect(() => {
    if (!merchant?.id) {
      setServiceFee(0);`;
if (!source.includes('get_delivery_checkout_readiness')) {
  if (!source.includes(configEffectEnd)) throw new Error('[FAIL] Entregas: final do carregamento do estabelecimento não encontrado.');
  const readinessEffect = `  }, [merchant?.id]);

  useEffect(() => {
    let disposed = false;
    setDeliveryFinancialLoading(true);
    void (async () => {
      const { data, error } = await (supabase.rpc as any)("get_delivery_checkout_readiness");
      if (disposed) return;
      const available = !error && data?.delivery_available === true;
      const message = typeof data?.message === "string" ? data.message : null;
      setDeliveryFinancialReady(available);
      setDeliveryFinancialMessage(
        message || (available ? null : "A entrega está temporariamente indisponível. Tente retirada quando disponível."),
      );
      setDeliveryFinancialLoading(false);
      if (!available && merchantConfig?.pickup_enabled !== false) {
        setFulfillmentType("pickup");
        setDeliveryQuote(null);
      }
    })();
    return () => { disposed = true; };
  }, [merchantConfig?.pickup_enabled]);

  useEffect(() => {
    if (!merchant?.id) {
      setServiceFee(0);`;
  source = source.replace(configEffectEnd, readinessEffect);
}

const confirmAnchor = `      if (fulfillmentType === "delivery" && !address)
        throw new Error("Selecione um endereço de entrega antes de continuar.");`;
if (!source.includes('deliveryFinancialReady)')) {
  if (!source.includes(confirmAnchor)) throw new Error('[FAIL] Entregas: validação de endereço do checkout não encontrada.');
  source = source.replace(
    confirmAnchor,
    `      if (fulfillmentType === "delivery" && !deliveryFinancialReady)\n        throw new Error(deliveryFinancialMessage || "A entrega está temporariamente indisponível.");\n${confirmAnchor}`,
  );
}

source = source.replace(
  'disabled={merchantConfig?.delivery_enabled === false}',
  'disabled={merchantConfig?.delivery_enabled === false || deliveryFinancialLoading || !deliveryFinancialReady}',
);

const receivingClose = `          </div>
        </section>

        {fulfillmentType === "delivery" ? (`;
if (!source.includes('data-testid="delivery-financial-readiness"')) {
  if (!source.includes(receivingClose)) throw new Error('[FAIL] Entregas: seletor Entrega/Retirada não encontrado.');
  source = source.replace(
    receivingClose,
    `          </div>\n          {!deliveryFinancialLoading && !deliveryFinancialReady ? (\n            <div data-testid="delivery-financial-readiness" className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">\n              {deliveryFinancialMessage || "A entrega está temporariamente indisponível. Você ainda pode escolher retirada quando disponível."}\n            </div>\n          ) : null}\n        </section>\n\n        {fulfillmentType === "delivery" ? (`,
  );
}

for (const marker of [
  'get_delivery_checkout_readiness',
  'deliveryFinancialReady',
  'deliveryFinancialLoading',
  'deliveryFinancialMessage',
  'data-testid="delivery-financial-readiness"',
  'merchantConfig?.delivery_enabled === false || deliveryFinancialLoading || !deliveryFinancialReady',
]) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregas: readiness de entrega incompleto (${marker}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregas: checkout desabilita Entrega antes do pedido quando repasse direto do entregador ainda não está homologado.');
