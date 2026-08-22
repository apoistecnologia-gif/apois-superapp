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

for (const marker of [
  'As formas de pagamento e os fluxos financeiros disponíveis dependem das funcionalidades efetivamente habilitadas',
  'O aplicativo não oferece saque manual nem coleta chave PIX',
  'registros financeiros ou áreas administrativas de terceiros',
]) {
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
