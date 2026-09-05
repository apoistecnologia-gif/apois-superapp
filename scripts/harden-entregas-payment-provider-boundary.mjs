import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/entregas';
const full = (relative) => resolve(root, workspace, relative);

function write(relative, source) {
  writeFileSync(full(relative), source, 'utf8');
}

function read(relative) {
  return readFileSync(full(relative), 'utf8');
}

function replaceRequired(source, search, replacement, label) {
  if (source.includes(replacement)) return source;
  if (!source.includes(search)) throw new Error(`[FAIL] ${label}: padrão esperado não encontrado`);
  return source.replace(search, replacement);
}

// Sacola: método temporário é pagamento direto ao estabelecimento, sem gateway.
{
  const relative = 'src/routes/sacola.tsx';
  let source = read(relative);
  source = source.replaceAll('sessionStorage.setItem("apois_payment_method", "pix");', 'sessionStorage.setItem("apois_payment_method", "cash");');
  source = source.replace('PIX habilitado', 'Pagamento direto');
  source = source.replace('<p className="text-sm font-bold">PIX</p>', '<p className="text-sm font-bold">Pagamento direto ao estabelecimento</p>');
  source = source.replace(
    'Pagamento disponível e confirmado automaticamente.',
    'O aplicativo não processa nem confirma este pagamento eletronicamente.',
  );
  source = source.replace(
    '<span>O pedido só avança após a confirmação do PIX</span>',
    '<span>O pagamento é feito diretamente ao estabelecimento, fora do gateway da APOIS</span>',
  );
  if (!source.includes('"apois_payment_method", "cash"')) throw new Error('[FAIL] Entregas: sacola não seleciona pagamento direto');
  if (source.includes('PIX habilitado') || source.includes('confirmação do PIX')) throw new Error('[FAIL] Entregas: texto PIX ativo permaneceu na sacola');
  write(relative, source);
  console.log('[OK] Entregas: sacola usa pagamento direto ao estabelecimento.');
}

// Checkout: remove runtime Mercado Pago/PIX e finaliza pedido sem fabricar paid.
{
  const relative = 'src/routes/checkout.tsx';
  let source = read(relative);

  source = source.replace('  Check,\n', '').replace('  Copy,\n', '').replace('  QrCode,\n', '');
  source = source.replace('import QRCode from "qrcode";\n', '');

  const mpStart = source.indexOf('const MP_SECURITY_SCRIPT_ID');
  const pixTypeStart = source.indexOf('type PixData =');
  if (mpStart >= 0 && pixTypeStart > mpStart) source = source.slice(0, mpStart) + source.slice(pixTypeStart);

  const pixTypeEnd = source.indexOf('type CheckoutAttempt =');
  const currentPixTypeStart = source.indexOf('type PixData =');
  if (currentPixTypeStart >= 0 && pixTypeEnd > currentPixTypeStart) {
    source = source.slice(0, currentPixTypeStart) + source.slice(pixTypeEnd);
  }

  const loadPixStart = source.indexOf('function loadActivePix()');
  const fingerprintStart = source.indexOf('function checkoutFingerprint(');
  if (loadPixStart >= 0 && fingerprintStart > loadPixStart) {
    source = source.slice(0, loadPixStart) + source.slice(fingerprintStart);
  }

  source = source.replace('  const [pixData, setPixData] = useState<PixData | null>(loadActivePix);\n', '');
  source = source.replace('  const [copied, setCopied] = useState(false);\n', '');
  source = source.replace(
    '  const paymentMethod =\n    typeof window !== "undefined" ? sessionStorage.getItem("apois_payment_method") || "pix" : "pix";',
    '  const paymentMethod = "cash";',
  );
  source = source.replace('  const paymentMethod = "pix";', '  const paymentMethod = "cash";');
  source = source.replace(
    '  useEffect(() => {\n    ensureMercadoPagoSecurityScript();\n  }, []);',
    '  useEffect(() => {\n    sessionStorage.removeItem(ACTIVE_PIX_STORAGE_KEY);\n    sessionStorage.setItem("apois_payment_method", "cash");\n  }, []);',
  );
  source = source.replace('    if (items.length === 0 && !pixData) {', '    if (items.length === 0) {');
  source = source.replace('  }, [isHydrated, items.length, pixData, navigate]);', '  }, [isHydrated, items.length, navigate]);');

  const handlerStart = source.indexOf('  const handleCopyPix = () => {');
  const confirmStart = source.indexOf('  const handleConfirm = async () => {');
  if (handlerStart >= 0 && confirmStart > handlerStart) {
    source = source.slice(0, handlerStart) + source.slice(confirmStart);
  }

  source = source.replace(
    '      if (paymentMethod !== "pix") throw new Error("No momento, apenas PIX está disponível.");',
    '      if (paymentMethod !== "cash") throw new Error("A forma de pagamento selecionada não está disponível.");',
  );

  const providerStart = source.indexOf('      const { data: providerSetting } = await (supabase.rpc as any)("get_order_payment_provider");');
  const fingerprintAnchor = source.indexOf('      const fingerprint = checkoutFingerprint({');
  if (providerStart >= 0 && fingerprintAnchor > providerStart) {
    source = source.slice(0, providerStart) + source.slice(fingerprintAnchor);
  }

  source = source.replace('            paymentMethod: "pix",', '            paymentMethod: "cash",');

  const pixFunctionStart = source.indexOf('      const pixFunction =');
  const catchAnchor = source.indexOf('    } catch (error: any) {', pixFunctionStart >= 0 ? pixFunctionStart : 0);
  if (pixFunctionStart >= 0 && catchAnchor > pixFunctionStart) {
    const directFinalize = `      clearCart();\n      sessionStorage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);\n      sessionStorage.removeItem(ACTIVE_PIX_STORAGE_KEY);\n      toast.success("Pedido criado. O pagamento será feito diretamente ao estabelecimento.");\n      await navigate({\n        to: "/pedido/$orderId",\n        params: { orderId },\n        replace: true,\n      });\n      return;\n`;
    source = source.slice(0, pixFunctionStart) + directFinalize + source.slice(catchAnchor);
  }

  const pixScreenStart = source.indexOf('  if (pixData) {');
  const merchantGuardStart = source.indexOf('  if (!merchant || items.length === 0) {');
  if (pixScreenStart >= 0 && merchantGuardStart > pixScreenStart) {
    source = source.slice(0, pixScreenStart) + source.slice(merchantGuardStart);
  }

  source = source.replace('paymentMethod === "pix"', 'paymentMethod === "cash"');
  source = source.replace('<QrCode className="h-4 w-4 text-primary" />', '<Store className="h-4 w-4 text-primary" />');
  source = source.replace('<p className="text-sm font-bold">PIX</p>', '<p className="text-sm font-bold">Pagamento direto ao estabelecimento</p>');
  source = source.replace('<p className="text-[10px] font-bold text-primary">DISPONÍVEL</p>', '<p className="text-[10px] font-bold text-primary">SEM GATEWAY DA APOIS</p>');

  const pixComponentStart = source.indexOf('\nfunction PixPaymentScreen(');
  if (pixComponentStart >= 0) source = `${source.slice(0, pixComponentStart).trimEnd()}\n`;

  if (!source.includes('useCallback(')) {
    source = source.replace('import { useCallback, useEffect, useState } from "react";', 'import { useEffect, useState } from "react";');
  }

  const forbiddenMarkers = [
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
    'Pagamento PIX',
    'type PixData =',
    'PixPaymentScreen(',
    'pixData',
    'setPixData',
    'handleCopyPix',
    'QRCode',
    'QrCode',
  ];
  for (const forbidden of forbiddenMarkers) {
    if (source.includes(forbidden)) throw new Error(`[FAIL] Entregas: gateway/runtime antigo permaneceu no checkout (${forbidden}).`);
  }
  if (/mercadopago|openpix|pagbank|asaas/i.test(source)) {
    throw new Error('[FAIL] Entregas: checkout final ainda contém referência executável a gateway descontinuado.');
  }

  for (const marker of [
    'const paymentMethod = "cash";',
    'paymentMethod: "cash"',
    'Pedido criado. O pagamento será feito diretamente ao estabelecimento.',
    'to: "/pedido/$orderId"',
    'SEM GATEWAY DA APOIS',
  ]) {
    if (!source.includes(marker)) throw new Error(`[FAIL] Entregas: checkout direto incompleto (${marker}).`);
  }
  write(relative, source);
  console.log('[OK] Entregas: checkout não chama gateway e cria pedido com payment_status pendente por padrão.');
}

// Cancelamento/estorno: com pagamento direto não existe provider para a APOIS acionar.
for (const relative of [
  'src/routes/pedido/$orderId/index.tsx',
  'src/components/MerchantOrderControlCenter.tsx',
  'src/routes/merchant.tsx',
  'src/routes/admin.tsx',
]) {
  let source = read(relative);
  source = source.replace(
    /const \{ error: refundError \} = await supabase\.functions\.invoke\("process-superapp-refund", \{\s*body: \{ refundId(?:: [^}]+)? \},\s*\}\);/g,
    'const refundError = new Error("Pagamento direto: devolução automática por gateway não se aplica.");',
  );
  source = source.replace(
    /const \{ error \} = await supabase\.functions\.invoke\("process-superapp-refund", \{\s*body: \{ refundId(?:: [^}]+)? \},\s*\}\);/g,
    'const error = new Error("Pagamento direto: devolução automática por gateway não se aplica.");',
  );
  if (source.includes('process-superapp-refund')) {
    throw new Error(`[FAIL] Entregas: ${relative} ainda tenta processar estorno por gateway.`);
  }
  write(relative, source);
}
console.log('[OK] Entregas: cancelamentos não disparam estorno eletrônico quando o pagamento é direto.');

// Edge Function da cópia de integração: cash é permitido, sem alterar o default payment_status=pending do banco.
{
  const relative = 'supabase/functions/create-order/index.ts';
  let source = read(relative);
  source = replaceRequired(
    source,
    'const PAYMENT_METHODS = new Set(["pix"]);',
    'const PAYMENT_METHODS = new Set(["cash"]);',
    'Entregas create-order permite somente pagamento direto temporário',
  );
  if (source.includes('payment_status: "paid"') || source.includes("payment_status: 'paid'")) {
    throw new Error('[FAIL] Entregas: create-order não pode fabricar payment_status=paid.');
  }
  if (!source.includes('const PAYMENT_METHODS = new Set(["cash"]);')) {
    throw new Error('[FAIL] Entregas: create-order não ficou restrito ao método direto temporário.');
  }
  write(relative, source);
  console.log('[OK] Entregas: create-order aceita cash e preserva payment_status do banco.');
}

// Textos públicos coerentes com o boundary atual.
{
  const relative = 'src/routes/perfil/ajuda.tsx';
  let source = read(relative);
  source = source.replace(
    'O checkout atual utiliza PIX. Outras formas só aparecerão quando estiverem\n                efetivamente habilitadas pela plataforma.',
    'O pedido pode ser finalizado com pagamento direto ao estabelecimento. A APOIS não processa nem confirma esse pagamento eletronicamente nesta etapa.',
  );
  write(relative, source);
}

{
  const relative = 'src/routes/termos.tsx';
  let source = read(relative);
  source = source.replace(
    '"O checkout atualmente habilitado utiliza PIX por meio do provedor de pagamento integrado. Um pedido somente deve ser tratado como pago após a confirmação eletrônica do provedor recebida e validada pela plataforma.",\n      "A eventual disponibilização de outras formas de pagamento será informada na própria interface quando estiver efetivamente habilitada.",',
    '"O checkout atualmente habilitado registra pagamento direto ao estabelecimento. A APOIS não processa a cobrança nem marca automaticamente o pedido como pago.",\n      "Meios eletrônicos integrados somente serão informados na interface quando estiverem efetivamente homologados e habilitados.",',
  );
  source = source.replace(
    '"Pedidos podem ter regras diferentes de cancelamento conforme a etapa operacional. Quando um pedido pago for cancelado em hipótese que gere devolução, o estorno seguirá o fluxo do provedor de pagamento e ficará registrado no histórico financeiro da plataforma.",\n      "A plataforma não considera uma devolução concluída apenas pela alteração visual do pedido: o resultado do provedor de pagamento deve ser conciliado antes da confirmação final do estorno.",',
    '"Pedidos podem ter regras diferentes de cancelamento conforme a etapa operacional. Quando o pagamento tiver sido feito diretamente ao estabelecimento, eventual devolução deverá ser tratada com o próprio estabelecimento conforme o caso e a legislação aplicável.",\n      "Quando futuramente houver meio eletrônico integrado, as regras específicas de estorno e conciliação serão informadas na própria plataforma.",',
  );
  write(relative, source);
}

{
  const relative = 'src/routes/privacidade.tsx';
  let source = read(relative);
  source = source.replace(
    '"Dados completos de cartão não fazem parte do checkout atualmente habilitado. O pagamento disponível na operação atual é PIX processado pelo provedor de pagamento integrado.",',
    '"Dados completos de cartão não fazem parte do checkout atualmente habilitado. Na operação atual, o pagamento é realizado diretamente ao estabelecimento e não é processado pela APOIS.",',
  );
  source = source.replace(
    '"Os dados são utilizados para criar e proteger contas; executar pedidos e entregas; processar e conciliar pagamentos e estornos; prevenir fraude e abuso; atender solicitações de suporte; permitir avaliações; administrar estabelecimentos, entregadores e áreas autorizadas; cumprir obrigações legais e regulatórias; produzir registros de auditoria; exercer direitos em processos ou disputas; e aprimorar segurança e confiabilidade da operação.",',
    '"Os dados são utilizados para criar e proteger contas; executar pedidos e entregas; registrar informações operacionais sobre pagamentos quando necessário; prevenir fraude e abuso; atender solicitações de suporte; permitir avaliações; administrar estabelecimentos, entregadores e áreas autorizadas; cumprir obrigações legais e regulatórias; produzir registros de auditoria; exercer direitos em processos ou disputas; e aprimorar segurança e confiabilidade da operação.",',
  );
  source = source.replace(
    '"Os dados podem ser compartilhados na medida necessária para a execução do serviço entre cliente, estabelecimento e entregador responsável pela operação. A plataforma também utiliza fornecedores de infraestrutura e serviços tecnológicos, como hospedagem e banco de dados Supabase, mapas e geolocalização Google Maps e processamento de PIX Mercado Pago, dentro da finalidade de cada integração.",',
    '"Os dados podem ser compartilhados na medida necessária para a execução do serviço entre cliente, estabelecimento e entregador responsável pela operação. A plataforma também utiliza fornecedores de infraestrutura e serviços tecnológicos, como hospedagem e banco de dados Supabase e mapas e geolocalização Google Maps, dentro da finalidade de cada integração.",',
  );
  write(relative, source);
}

for (const relative of [
  'src/routes/sacola.tsx',
  'src/routes/checkout.tsx',
  'src/routes/perfil/ajuda.tsx',
  'src/routes/termos.tsx',
  'src/routes/privacidade.tsx',
]) {
  const source = read(relative);
  if (/checkout atual(?:mente)?[^\n]{0,120}PIX|PIX habilitado|processamento de PIX Mercado Pago/i.test(source)) {
    throw new Error(`[FAIL] Entregas: texto financeiro legado permaneceu em ${relative}`);
  }
}

console.log('[OK] Entregas: boundary financeiro temporário materializado sem Mercado Pago, PagBank, Asaas ou OpenPix no fluxo ativo.');
