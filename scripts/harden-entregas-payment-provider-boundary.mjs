import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const full = (relative) => resolve(root, workspace, relative);
const PAYMENT_STORAGE_KEY = 'apois-superapp-entregas:payment-method';

function read(relative) {
  return readFileSync(full(relative), 'utf8');
}
function write(relative, source) {
  writeFileSync(full(relative), source, 'utf8');
}
function required(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error('[FAIL] ' + label + ': padrão esperado não encontrado');
  return source.replace(search, replacement);
}

// Sacola: Safe2Pay PIX is the sole electronic checkout target.
{
  const relative = 'src/routes/sacola.tsx';
  let source = read(relative);
  for (const key of ['apois_payment_method', PAYMENT_STORAGE_KEY]) {
    source = source.replaceAll(
      `sessionStorage.setItem("${key}", "cash");`,
      `sessionStorage.setItem("${PAYMENT_STORAGE_KEY}", "pix");`,
    );
    source = source.replaceAll(
      `sessionStorage.setItem("${key}", "pix");`,
      `sessionStorage.setItem("${PAYMENT_STORAGE_KEY}", "pix");`,
    );
  }
  source = source.replaceAll('Pagamento direto', 'PIX Safe2Pay');
  source = source.replaceAll('Pagamento direto ao estabelecimento', 'PIX Safe2Pay');
  source = source.replaceAll(
    'O pagamento é feito diretamente ao estabelecimento, fora do gateway da APOIS',
    'O pagamento PIX é processado pela Safe2Pay e confirmado somente após retorno do backend.',
  );
  if (!source.includes(`"${PAYMENT_STORAGE_KEY}", "pix"`)) {
    throw new Error('[FAIL] Entregas: sacola não seleciona PIX Safe2Pay após namespacing');
  }
  write(relative, source);
  console.log('[OK] Entregas: sacola aponta para PIX Safe2Pay.');
}

// Checkout: remove all retired provider branches and bind PIX to Safe2Pay.
{
  const relative = 'src/routes/checkout.tsx';
  let source = read(relative);

  const mpStart = source.indexOf('const MP_SECURITY_SCRIPT_ID');
  const pixTypeStart = source.indexOf('type PixData =');
  if (mpStart >= 0 && pixTypeStart > mpStart) {
    source = source.slice(0, mpStart) + source.slice(pixTypeStart);
  }

  source = source.replace(
    '  useEffect(() => {\n    ensureMercadoPagoSecurityScript();\n  }, []);',
    `  useEffect(() => {\n    sessionStorage.setItem("${PAYMENT_STORAGE_KEY}", "pix");\n  }, []);`,
  );

  for (const key of ['apois_payment_method', PAYMENT_STORAGE_KEY]) {
    source = source.replace(
      `  const paymentMethod =\n    typeof window !== "undefined" ? sessionStorage.getItem("${key}") || "pix" : "pix";`,
      '  const paymentMethod = "pix";',
    );
  }

  const providerStart = source.indexOf('      const { data: providerSetting } = await (supabase.rpc as any)("get_order_payment_provider");');
  const fingerprintAnchor = source.indexOf('      const fingerprint = checkoutFingerprint({', providerStart >= 0 ? providerStart : 0);
  if (providerStart >= 0 && fingerprintAnchor > providerStart) {
    source = source.slice(0, providerStart)
      + '      const configuredProvider = "safe2pay_marketplace";\n\n'
      + source.slice(fingerprintAnchor);
  }

  source = source.replaceAll('paymentMethod: "cash"', 'paymentMethod: "pix"');
  source = source.replaceAll('const paymentMethod = "cash";', 'const paymentMethod = "pix";');

  const pixFunctionStart = source.indexOf('      const pixFunction =');
  const pixInvokeEndAnchor = source.indexOf('      if (pixError) {', pixFunctionStart >= 0 ? pixFunctionStart : 0);
  if (pixFunctionStart >= 0 && pixInvokeEndAnchor > pixFunctionStart) {
    const replacement =
`      if (configuredProvider !== "safe2pay_marketplace") {
        throw new Error("O provedor PIX ainda não está habilitado para este pedido.");
      }
      const { data: pixResponse, error: pixError } = await supabase.functions.invoke(
        "safe2pay-create-order-pix",
        { body: { order_id: orderId } },
      );
`;
    source = source.slice(0, pixFunctionStart) + replacement + source.slice(pixInvokeEndAnchor);
  }

  const newPaymentBlock =
`      const qrCodeText = pixResponse?.pix?.copyPaste;
      const qrCodeBase64 = pixResponse?.pix?.qrCodeBase64;
      if (typeof qrCodeText !== "string" || !qrCodeText.trim()) {
        throw new Error("A Safe2Pay não retornou o código PIX desta cobrança.");
      }

      const nextPixData: PixData = {
        qrCodeImageUrl:
          typeof qrCodeBase64 === "string" && qrCodeBase64.trim()
            ? (qrCodeBase64.startsWith("data:") ? qrCodeBase64 : \`data:image/png;base64,\${qrCodeBase64}\`)
            : "",
        qrCodeText,
        orderId,
        total: Number(pixResponse?.amount) || Number(orderResponse?.total) || total,
        expiresAt: null,
      };`;

  // O snapshot pode sofrer hardening de UI/storage antes deste boundary. Não dependa
  // da igualdade textual do bloco inteiro legado; substitua somente o trecho
  // financeiro delimitado por marcadores estáveis e falhe fechado se ele sumir.
  if (!source.includes(newPaymentBlock)) {
    const legacyPaymentStart = source.indexOf('      const payment = pixResponse?.payment;');
    const setPixDataAnchor = source.indexOf('      setPixData(nextPixData);', legacyPaymentStart >= 0 ? legacyPaymentStart : 0);
    if (legacyPaymentStart < 0 || setPixDataAnchor <= legacyPaymentStart) {
      throw new Error('[FAIL] checkout adapta resposta Safe2Pay: bloco financeiro legado não reconhecido');
    }
    source = source.slice(0, legacyPaymentStart)
      + newPaymentBlock
      + '\n'
      + source.slice(setPixDataAnchor);
  }

  source = source.replace(
`      const { data, error } = await supabase.functions.invoke("sync-payment-status", {
        body: { orderId: pixData.orderId },
      });`,
`      const { data, error } = await supabase.functions.invoke("safe2pay-payment-status", {
        body: { resource_type: "order", resource_id: pixData.orderId },
      });`,
  );

  source = source.replaceAll('PIX habilitado', 'PIX Safe2Pay');
  source = source.replaceAll('<p className="text-sm font-bold">PIX</p>', '<p className="text-sm font-bold">PIX Safe2Pay</p>');
  source = source.replaceAll('<p className="text-[10px] font-bold text-primary">DISPONÍVEL</p>', '<p className="text-[10px] font-bold text-primary">PROCESSADO PELA SAFE2PAY</p>');

  const forbidden = [
    'merchant-payment-readiness',
    'create-merchant-mercadopago-pix',
    'create-asaas-pix-charge',
    'create-pix-charge',
    'openpix-payout',
    'mercadopago.com/v2/security.js',
    'MP_DEVICE_SESSION_ID',
    'ensureMercadoPagoSecurityScript',
    'readMercadoPagoDeviceId',
    'sync-payment-status',
  ];
  for (const marker of forbidden) {
    if (source.includes(marker)) throw new Error('[FAIL] Entregas: provider aposentado permaneceu no checkout (' + marker + ')');
  }
  for (const marker of [
    'const paymentMethod = "pix";',
    'paymentMethod: "pix"',
    '"safe2pay-create-order-pix"',
    '"safe2pay-payment-status"',
    'configuredProvider = "safe2pay_marketplace"',
    'pixResponse?.pix?.copyPaste',
  ]) {
    if (!source.includes(marker)) throw new Error('[FAIL] Entregas: Safe2Pay checkout incompleto (' + marker + ')');
  }

  write(relative, source);
  console.log('[OK] Entregas: checkout PIX usa somente Safe2Pay.');
}

// Integration copy of create-order: order is created pending, never paid by the client.
{
  const relative = 'supabase/functions/create-order/index.ts';
  let source = read(relative);
  source = source.replace('const PAYMENT_METHODS = new Set(["cash"]);', 'const PAYMENT_METHODS = new Set(["pix"]);');
  source = source.replace('snapshot.payment_method !== "cash"', 'snapshot.payment_method !== "pix"');
  if (!source.includes('const PAYMENT_METHODS = new Set(["pix"]);')) {
    throw new Error('[FAIL] Entregas: create-order não permite PIX Safe2Pay');
  }
  if (source.includes('payment_status: "paid"') || source.includes("payment_status: 'paid'")) {
    throw new Error('[FAIL] Entregas: create-order não pode fabricar payment_status=paid');
  }
  write(relative, source);
}

// Refunds remain fail-closed until a Safe2Pay refund contract is implemented.
for (const relative of [
  'src/routes/pedido/$orderId/index.tsx',
  'src/components/MerchantOrderControlCenter.tsx',
  'src/routes/merchant.tsx',
  'src/routes/admin.tsx',
]) {
  let source = read(relative);
  source = source.replace(
    /const \{ error: refundError \} = await supabase\.functions\.invoke\("process-superapp-refund", \{\s*body: \{ refundId(?:: [^}]+)? \},\s*\}\);/g,
    'const refundError = new Error("Estorno Safe2Pay ainda não está habilitado nesta versão.");',
  );
  source = source.replace(
    /const \{ error \} = await supabase\.functions\.invoke\("process-superapp-refund", \{\s*body: \{ refundId(?:: [^}]+)? \},\s*\}\);/g,
    'const error = new Error("Estorno Safe2Pay ainda não está habilitado nesta versão.");',
  );
  if (source.includes('process-superapp-refund')) {
    throw new Error('[FAIL] Entregas: ' + relative + ' ainda chama refund de provider aposentado');
  }
  write(relative, source);
}

// Public copy must describe the actual provider boundary.
for (const relative of ['src/routes/perfil/ajuda.tsx','src/routes/termos.tsx','src/routes/privacidade.tsx']) {
  let source = read(relative);
  source = source
    .replaceAll('Mercado Pago', 'Safe2Pay')
    .replaceAll('mercadopago', 'safe2pay')
    .replaceAll('OpenPix', 'Safe2Pay')
    .replaceAll('Asaas', 'Safe2Pay')
    .replaceAll('PagBank', 'Safe2Pay')
    .replaceAll('pagbank', 'safe2pay')
    .replaceAll('openpix', 'safe2pay')
    .replaceAll('asaas', 'safe2pay');
  write(relative, source);
}

console.log('[OK] Entregas: boundary financeiro Safe2Pay materializado; providers antigos permanecem fora do fluxo ativo.');
