import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const workspace = process.env.APOIS_MOTORISTA_WORKSPACE || '.work/partner-motorista';

function patch(relativePath, transform, label) {
  const path = resolve(root, workspace, relativePath);
  const before = readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`[OK] ${label} (já aplicado/sem alteração)`);
    return;
  }
  writeFileSync(path, after, 'utf8');
  console.log(`[OK] ${label}`);
}

patch('src/lib/driverFinance.mobile.ts', (source) => {
  const withdrawalMarker = 'export async function requestDriverWithdrawal';
  const withdrawalStart = source.indexOf(withdrawalMarker);
  if (withdrawalStart < 0) throw new Error('[FAIL] driverFinance.mobile.ts: requestDriverWithdrawal não encontrado');
  const helperStart = source.lastIndexOf('function secureUuid()', withdrawalStart);
  const start = helperStart >= 0 ? helperStart : withdrawalStart;

  const safeStub = `export async function requestDriverWithdrawal(_amountCents: number): Promise<void> {\n  throw new Error(\n    \"Saque manual não está disponível no APOIS Parceiro. Os recebimentos das corridas são diretos ao motorista.\",\n  );\n}\n`;

  const next = source.slice(0, start) + safeStub;
  for (const forbidden of ['request-driver-payout', 'secureUuid()', 'asaas_subaccount', 'driver_wallet_debt', 'pix_payout_destination']) {
    if (next.includes(forbidden)) {
      throw new Error(`[FAIL] driverFinance.mobile.ts: resíduo legado de saque permaneceu (${forbidden})`);
    }
  }
  return next;
}, 'motorista: runtime legado de saque e helper de idempotência removidos do APK Parceiro');

patch('src/components/notifications/NotificationPreferencesPage.tsx', (source) => {
  let next = source;
  next = next.replace(
    'Avisos sobre mensalidade, carteira e outras movimentações da sua conta.',
    'Avisos sobre mensalidade, pagamentos e registros dos seus recebimentos.',
  );
  if (next.includes('mensalidade, carteira')) {
    throw new Error('[FAIL] NotificationPreferencesPage.tsx: referência à carteira do motorista permaneceu');
  }
  return next;
}, 'motorista: preferências de notificação sem promessa de carteira custodial');

patch('src/routes/motorista.privacidade.tsx', (source) => {
  let next = source;
  next = next.replace(
    'de verificação cadastral, corridas, avaliações, notificações, suporte, ganhos, carteira, pagamentos e repasses.',
    'de verificação cadastral, corridas, avaliações, notificações, suporte, ganhos registrados, pagamentos, liquidações e informações necessárias à conciliação dos recebimentos diretos.',
  );
  next = next.replace(
    'prevenção a fraude, suporte, pagamentos e repasses. Para prestar esses serviços, a APOIS pode utilizar operadores',
    'prevenção a fraude, suporte, pagamentos e conciliação dos recebimentos diretos. Para prestar esses serviços, a APOIS pode utilizar operadores',
  );
  next = next.replace(
    'Registros de corridas, pagamentos, repasses, segurança, auditoria,',
    'Registros de corridas, pagamentos, liquidações, segurança, auditoria,',
  );

  const firstDataSection = `              </p>\n            </section>`;
  if (!next.includes('A APOIS não utiliza uma carteira custodial')) {
    const first = next.indexOf(firstDataSection);
    if (first < 0) throw new Error('[FAIL] motorista.privacidade.tsx: fim da seção Dados tratados não encontrado');
    const insert = `              </p>\n              <p className="mt-3 break-words text-zinc-400">A APOIS não utiliza uma carteira custodial do motorista para valores recebidos diretamente em dinheiro ou cartão.</p>\n            </section>`;
    next = next.slice(0, first) + insert + next.slice(first + firstDataSection.length);
  }

  if (next.includes('ganhos, carteira, pagamentos')) {
    throw new Error('[FAIL] motorista.privacidade.tsx: carteira custodial ainda declarada');
  }
  if (!next.includes('recebimentos diretos')) {
    throw new Error('[FAIL] motorista.privacidade.tsx: recebimento direto não explicitado');
  }
  return next;
}, 'motorista: privacidade alinhada ao recebimento direto e sem carteira custodial');

patch('src/routes/motorista.termos.tsx', (source) => {
  let next = source;
  const old = `                A APOIS é uma plataforma de intermediação tecnológica. As formas de pagamento disponibilizadas no aplicativo\n                podem utilizar provedores de pagamento integrados à plataforma, conforme a configuração operacional vigente.\n                O valor devido ao motorista, eventuais cobranças do passageiro, registros de liquidação e repasses seguem os\n                fluxos financeiros e as regras exibidas no aplicativo. A assinatura mensal do motorista libera o recebimento\n                de ofertas quando os demais requisitos cadastrais e operacionais também estiverem regulares.`;
  const replacement = `                A APOIS é uma plataforma de intermediação tecnológica. As formas de pagamento habilitadas podem incluir Pix,\n                dinheiro e cartão. Dinheiro e cartão são recebidos diretamente pelo motorista; pagamentos digitais seguem o\n                fluxo direto habilitado para a operação. A APOIS não retém comissão por corrida nem recebe o valor integral da\n                corrida para depois repassá-lo ao motorista. A mensalidade do motorista é uma cobrança separada da corrida e\n                libera o recebimento de ofertas quando os demais requisitos cadastrais e operacionais também estiverem regulares.`;
  if (next.includes(old)) next = next.replace(old, replacement);
  else if (!next.includes('A APOIS não retém comissão por corrida')) {
    throw new Error('[FAIL] motorista.termos.tsx: bloco financeiro esperado não encontrado');
  }

  next = next.replace(
    'Esta é uma versão preliminar. O texto oficial será publicado pela APOIS em breve.',
    'Quando houver um texto oficial público configurado pela APOIS, o aplicativo o abrirá automaticamente. Na ausência dele, aplicam-se as regras operacionais exibidas nesta tela.',
  );

  if (next.includes('versão preliminar')) {
    throw new Error('[FAIL] motorista.termos.tsx: aviso de versão preliminar permaneceu');
  }
  if (!next.includes('A APOIS não retém comissão por corrida')) {
    throw new Error('[FAIL] motorista.termos.tsx: política de comissão zero ausente');
  }
  return next;
}, 'motorista: termos alinhados a dinheiro/Pix/cartão e comissão zero');

patch('src/components/support/HelpCenterView.tsx', (source) => {
  let next = source;
  next = next.replace(
    'setLoadError("Entre na sua conta para abrir e acompanhar atendimentos.");',
    'setLoadError(isDriver ? "Entre na sua conta para enviar uma solicitação de suporte." : "Entre na sua conta para abrir e acompanhar atendimentos.");',
  );
  if (!next.includes('Entre na sua conta para enviar uma solicitação de suporte.')) {
    throw new Error('[FAIL] HelpCenterView.tsx: mensagem correta para suporte do motorista não foi aplicada');
  }
  return next;
}, 'motorista: suporte não promete acompanhamento de protocolo inexistente');

patch('src/routes/motorista.assinatura.tsx', (source) => {
  let next = source;
  next = next.replace(
    '"Repasse integral das corridas ao motorista",',
    '"100% do valor da corrida para o motorista",',
  );
  if (next.includes('Repasse integral das corridas ao motorista')) {
    throw new Error('[FAIL] motorista.assinatura.tsx: wording custodial de repasse permaneceu');
  }
  if (!next.includes('"100% do valor da corrida para o motorista"')) {
    throw new Error('[FAIL] motorista.assinatura.tsx: benefício de 100% da corrida ausente');
  }
  return next;
}, 'motorista: mensalidade descreve 100% da corrida sem sugerir custódia');

console.log(`[OK] superfícies de release do Motorista endurecidas em ${workspace}`);
