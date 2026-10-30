import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// QA-only mitigation. Never expose cash or override delivery radius in production.
if (process.env.APOIS_ENTREGAS_CASH_TEST_MODE !== "1") {
  throw Error("[FAIL] Stale-quote hardener requires the isolated QA customer build");
}
const checkoutPath = resolve(process.env.APOIS_ENTREGAS_WORKSPACE || ".work/entregas", "src/routes/checkout.tsx");
let source = readFileSync(checkoutPath, "utf8");
const marker = "APOIS_QA_DELIVERY_QUOTE_REFRESH_V1";
const lines = (...parts) => parts.join("\n");
function replaceOne(before, after, label) {
  const occurrences = source.split(before).length - 1;
  if (occurrences !== 1) throw Error("[FAIL] " + label + " count=" + occurrences);
  source = source.replace(before, after);
}
if (!source.includes(marker)) {
  if (!source.includes('const paymentMethod = "cash";') || !source.includes('paymentMethod: "cash"')) {
    throw Error("[FAIL] QA checkout cash boundary not present");
  }
  replaceOne(
    '  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);',
    lines(
      '  const [deliveryQuoteLoading, setDeliveryQuoteLoading] = useState(false);',
      '  // APOIS_QA_DELIVERY_QUOTE_REFRESH_V1: a stale quote never authorizes an order.',
      '  const [quoteRefreshSeq, setQuoteRefreshSeq] = useState(0);',
      '  useEffect(() => {',
      '    const refreshQuoteOnReturn = () => {',
      '      if (document.visibilityState === "visible") setQuoteRefreshSeq((n) => n + 1);',
      '    };',
      '    window.addEventListener("focus", refreshQuoteOnReturn);',
      '    document.addEventListener("visibilitychange", refreshQuoteOnReturn);',
      '    return () => {',
      '      window.removeEventListener("focus", refreshQuoteOnReturn);',
      '      document.removeEventListener("visibilitychange", refreshQuoteOnReturn);',
      '    };',
      '  }, []);'
    ),
    'focus listener'
  );
  replaceOne(
    '  }, [isHydrated, items.length, navigate]);',
    '  }, [isHydrated, items.length, navigate, quoteRefreshSeq]);',
    'reload default address on app resume'
  );
  replaceOne(
    '  }, [address, fulfillmentType, merchant?.id, merchantConfig?.minimum_order]);',
    '  }, [address, fulfillmentType, merchant?.id, merchantConfig?.minimum_order, quoteRefreshSeq]);',
    'fresh area quote on app resume'
  );
  replaceOne(
    lines(
      '      if (fulfillmentType === "delivery" && deliveryQuoteLoading)',
      '        throw new Error("Aguarde a validação da área de entrega.");',
      '      if (fulfillmentType === "delivery" && deliveryQuote?.eligible !== true)',
      '        throw new Error("Este endereço está fora da área de entrega disponível.");'
    ),
    lines(
      '      // Confirm eligibility from the server, not from a cached quote.',
      '      if (fulfillmentType === "delivery" && address) {',
      '        const { data: freshRows, error: freshError } = await (supabase.rpc as any)("preview_delivery_quote", {',
      '          p_merchant_id: merchant?.id,',
      '          p_delivery_address: address,',
      '        });',
      '        if (freshError) {',
      '          console.error("Falha ao revalidar entrega QA:", freshError);',
      '          throw new Error("Não foi possível revalidar a entrega. Tente novamente.");',
      '        }',
      '        const freshQuote = Array.isArray(freshRows) ? freshRows[0] : null;',
      '        if (!freshQuote) throw new Error("Não foi possível obter a cotação da entrega.");',
      '        setDeliveryQuote(freshQuote as DeliveryQuote);',
      '        if (freshQuote.eligible !== true) {',
      '          if (freshQuote.reason === "outside_served_city")',
      '            throw new Error("A cidade deste endereço não é atendida pelo estabelecimento.");',
      '          if (freshQuote.reason === "outside_default_radius" || freshQuote.reason === "outside_delivery_zone")',
      '            throw new Error("Este endereço está fora da área de entrega disponível.");',
      '          throw new Error("Não foi possível validar este endereço. Confira o destino e tente novamente.");',
      '        }',
      '      }'
    ),
    'fresh quote required before creating order'
  );
  const anchor = lines(
    '          {fulfillmentType === "delivery" &&',
    '          address &&',
    '          deliveryQuote?.reason === "coordinates_required" ? ('
  );
  replaceOne(
    anchor,
    lines(
      '          {fulfillmentType === "delivery" && address && !deliveryQuoteLoading && deliveryQuote?.eligible !== true ? (',
      '            <button',
      '              type="button"',
      '              data-testid="qa-recheck-delivery-area"',
      '              className="mt-2 flex w-full items-center justify-center rounded-xl border border-primary/40 bg-primary/10 p-3 text-sm font-bold text-primary"',
      '              onClick={() => setQuoteRefreshSeq((n) => n + 1)}',
      '            >',
      '              Revalidar área de entrega',
      '            </button>',
      '          ) : null}',
      anchor
    ),
    'manual QA quote recheck'
  );
  for (const expected of [marker,'Revalidar área de entrega','freshQuote.eligible !== true','const paymentMethod = "cash";','paymentMethod: "cash"']) {
    if (!source.includes(expected)) throw Error("[FAIL] Missing expected QA marker " + expected);
  }
  writeFileSync(checkoutPath, source, "utf8");
}
console.log("[OK] QA checkout rechecks the real server quote on return, retry and submit; radius unchanged.");
