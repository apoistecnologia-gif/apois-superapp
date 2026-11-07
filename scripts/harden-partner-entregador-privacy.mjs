import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_ENTREGAS_WORKSPACE || '.work/partner-entregador';
const path = resolve(root, workspace, 'src/routes/privacidade.tsx');
let source = readFileSync(path, 'utf8');

// As strings do snapshot mudam entre releases. Substituição condicional: aplica
// se o texto antigo existir; o contrato no fim garante o resultado final.
function replaceIfPresent(source, before, after) {
  return source.includes(before) ? source.replace(before, after) : source;
}

source = replaceIfPresent(
  source,
  '"Para estabelecimentos e entregadores, também podem ser tratados dados cadastrais, documentos de habilitação ou regularidade, informações do veículo, dados operacionais, localização durante a atividade, carteira, chave PIX e registros de pagamentos ou saques, de acordo com a funcionalidade utilizada.",',
  '"Para estabelecimentos e entregadores, também podem ser tratados dados cadastrais, documentos de habilitação ou regularidade, informações do veículo, dados operacionais, localização durante a atividade e registros necessários à conciliação de ganhos e repasses, de acordo com a funcionalidade efetivamente habilitada.",',
);

source = replaceIfPresent(
  source,
  '"Dados completos de cartão não fazem parte do checkout atualmente habilitado. O pagamento disponível na operação atual é PIX processado pelo provedor de pagamento integrado.",',
  '"No aplicativo do entregador, dados completos de cartão não são solicitados. Chave PIX e solicitação manual de saque também não são coletadas enquanto o repasse direto ao entregador pelo provedor financeiro estiver em homologação.",',
);

source = replaceIfPresent(
  source,
  '"Os dados podem ser compartilhados na medida necessária para a execução do serviço entre cliente, estabelecimento e entregador responsável pela operação. A plataforma também utiliza fornecedores de infraestrutura e serviços tecnológicos, como hospedagem e banco de dados Supabase, mapas e geolocalização Google Maps e processamento de PIX Mercado Pago, dentro da finalidade de cada integração.",',
  '"Os dados podem ser compartilhados na medida necessária para a execução do serviço entre cliente, estabelecimento e entregador responsável pela operação. A plataforma também utiliza fornecedores de infraestrutura e serviços tecnológicos, como hospedagem e banco de dados Supabase, mapas e geolocalização Google Maps e, nos fluxos financeiros efetivamente habilitados, o provedor de pagamento integrado, dentro da finalidade de cada integração.",',
);

// O contrato é o SIGNIFICADO, não a redação. O snapshot pode já descrever o
// pagamento direto ao estabelecimento em vez de PIX processado — nesse caso a
// política está correta e não deve ser reescrita. Falha só se a política
// prometer algo que o produto não faz.
const required = [
  // ganhos/repasses precisam estar descritos como conciliação, não como carteira ativa
  /concilia[çc][ãa]o de ganhos|ganhos e repasses/i,
];
for (const pattern of required) {
  if (!pattern.test(source)) throw new Error(`[FAIL] Entregador Parceiro: política de privacidade não cobre ${pattern}`);
}
const forbidden = [
  'carteira, chave PIX e registros de pagamentos ou saques',
  'O pagamento disponível na operação atual é PIX',
  'processamento de PIX Mercado Pago',
];
for (const text of forbidden) {
  if (source.includes(text)) throw new Error(`[FAIL] Entregador Parceiro: política de privacidade ainda promete ${text}`);
}

for (const forbidden of [
  'carteira, chave PIX e registros de pagamentos ou saques',
  'O pagamento disponível na operação atual é PIX',
  'processamento de PIX Mercado Pago',
]) {
  if (source.includes(forbidden)) throw new Error(`[FAIL] Entregador Parceiro: política de privacidade ainda contém estado financeiro legado (${forbidden}).`);
}

writeFileSync(path, source, 'utf8');
console.log('[OK] Entregador Parceiro: política de privacidade não promete PIX-only, carteira/chave PIX ou saque manual antes da homologação do repasse direto.');
