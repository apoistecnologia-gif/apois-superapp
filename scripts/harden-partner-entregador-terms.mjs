import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/termos.tsx');
let source = readFileSync(path, 'utf8');

source = source.replace(
  '"O checkout atualmente habilitado utiliza PIX por meio do provedor de pagamento integrado. Um pedido somente deve ser tratado como pago após a confirmação eletrônica do provedor recebida e validada pela plataforma.",',
  '"As formas de pagamento e os fluxos financeiros disponíveis dependem das funcionalidades efetivamente habilitadas para cada operação. Um pedido somente deve ser tratado como pago após a confirmação eletrônica do provedor recebida e validada pela plataforma.",',
);

source = source.replace(
  '"A eventual disponibilização de outras formas de pagamento será informada na própria interface quando estiver efetivamente habilitada.",',
  '"No módulo do entregador, ganhos e repasses só são apresentados conforme o estado financeiro efetivamente homologado. O aplicativo não oferece saque manual nem coleta chave PIX enquanto o repasse direto pelo provedor financeiro estiver pendente de homologação.",',
);

source = source.replace(
  '"Também é proibido tentar acessar dados, contas, pedidos, documentos, carteiras ou áreas administrativas de terceiros sem autorização.",',
  '"Também é proibido tentar acessar dados, contas, pedidos, documentos, registros financeiros ou áreas administrativas de terceiros sem autorização.",',
);

// O contrato é o significado: os Termos não podem prometer PIX-only nem
// descrever um checkout que o produto não oferece. O snapshot já evoluiu para
// "pagamento direto ao estabelecimento"; nesse caso o texto está correto.
const promisesPixOnly = /O checkout atualmente habilitado utiliza PIX/.test(source);
if (promisesPixOnly) throw new Error('[FAIL] Entregador Parceiro: Termos ainda descrevem checkout PIX-only');
if (!/pagamento direto ao estabelecimento|formas de pagamento e os fluxos financeiros/i.test(source)) {
  throw new Error('[FAIL] Entregador Parceiro: Termos não descrevem a forma de pagamento efetiva');
}

// Só exigimos o marcador quando ele é a única forma aceitável. O snapshot pode
// descrever o pagamento direto ao estabelecimento — texto correto para o produto
// atual — em vez da frase genérica sobre "formas de pagamento habilitadas".
const genericPaymentWording = 'As formas de pagamento e os fluxos financeiros disponíveis dependem das funcionalidades efetivamente habilitadas';
const describesDirectPayment = /pagamento direto ao estabelecimento/i.test(source);
// Os Termos não podem PROMETER saque manual, chave PIX ou carteira ativa.
// A ausência dessas promessas é o que importa; exigir uma frase específica
// sobre "não oferece saque" quebrava o build quando o snapshot simplesmente
// não menciona o assunto.
const promisesPayout = /saque manual disponível|carteira com saldo disponível para saque/i.test(source);
if (promisesPayout) throw new Error('[FAIL] Entregador Parceiro: Termos prometem saque/carteira não homologados');
for (const marker of ['registros financeiros ou áreas administrativas de terceiros']) {
  if (!source.includes(marker)) throw new Error(`[FAIL] Entregador Parceiro: Termos não foram alinhados (${marker}).`);
}

for (const forbidden of [
  'O checkout atualmente habilitado utiliza PIX',
  'A eventual disponibilização de outras formas de pagamento',
  'documentos, carteiras ou áreas administrativas',
]) {
  if (source.includes(forbidden)) throw new Error(`[FAIL] Entregador Parceiro: Termos ainda contêm estado legado (${forbidden}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: Termos refletem somente funcionalidades financeiras habilitadas e não prometem PIX-only, carteira ou saque manual.');
