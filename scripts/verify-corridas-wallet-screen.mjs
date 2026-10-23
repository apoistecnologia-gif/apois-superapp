// Teste da tela Carteira: somente consultas financeiras existentes.
// Executar durante a futura compilacao do Cliente, apos o hardener de Carteira.
// Nenhum request, mutacao de banco, build Android ou APK e executado aqui.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const work = resolve(process.env.APOIS_CORRIDAS_WORKSPACE || '.work/corridas');
const read = (path) => readFileSync(resolve(work, path), 'utf8');

const wallet = read('src/routes/_authenticated.carteira.tsx');
const walletProvider = read('src/hooks/use-wallet.tsx');
const walletService = read('src/services/wallet/wallet-service.ts');
const paymentService = read('src/services/payments/payment-service.ts');
const layout = read('src/routes/_authenticated.tsx');
const paymentMethods = read('src/hooks/use-payment-methods.tsx');

for (const marker of [
  'APOIS_CLIENT_WALLET_SCREEN_V1',
  'createFileRoute("/_authenticated/carteira")',
  'useWallet()',
  'useAuth()',
  'usePaymentMethods()',
  'paymentService.getCancellationFees(userId)',
  'wallet.balance',
  'wallet.updatedAt',
  'wallet.blockedReason',
  'walletReady',
  'formatMoney(fee.amount)',
  'feesState === "failed"',
  'state === "blocked"',
  'state === "failed"',
  'state === "not_found"',
  'aria-label="Saldo da carteira"',
  'aria-label="Taxas de cancelamento pendentes"',
  'aria-label="Atualizar carteira e pendências"',
]) assert.ok(wallet.includes(marker), 'Carteira nao inclui requisito: '+marker);

assert.ok(layout.includes('<WalletProvider>'), 'WalletProvider existente nao pode ser removido');
assert.ok(walletProvider.includes('walletService.getWallet(userId)'), 'Carteira precisa consultar saldo real');
assert.ok(walletProvider.includes('state === "available"') === false || wallet.includes('state === "available"'), 'Estados de carteira incoerentes');
assert.ok(walletService.includes('.from("passenger_wallets")'), 'Saldo nao usa tabela oficial');
assert.ok(paymentService.includes('.from("cancellation_fees")'), 'Taxas nao usam tabela oficial');
assert.ok(paymentService.includes('.eq("passenger_id", userId)') && paymentService.includes('.eq("status", "pending")'), 'Taxas nao filtradas por usuario/status');
assert.ok(paymentMethods.includes('paymentService.getPaymentMethods()'), 'Forma de pagamento precisa ser real');

for (const banned of [
  '.insert(', '.update(', '.delete(', '.rpc(', 'checkout(', 'createPayment(', 'transferFunds(', 'chargeWallet(',
  'setSelectedMethod(', 'selectMethod(', 'setBalance(',
]) assert.ok(!wallet.includes(banned), 'Nova tela da Carteira tem mutacao financeira indevida: '+banned);
assert.ok(!wallet.includes('function CarteiraPage() {\n  return <div'), 'Placeholder ainda existe');
assert.ok(wallet.includes('Nenhuma carteira foi localizada'), 'Estado sem carteira pode exibir saldo ficticio');
assert.ok(wallet.includes('Não foi possível consultar o saldo'), 'Falha de consulta nao pode parecer saldo zero');
assert.ok(wallet.includes('Nenhuma taxa pendente encontrada.'), 'Estado sem taxa ausente');
assert.ok(wallet.includes('feeRequest.current'), 'Resposta de taxas desatualizada precisa ser descartada');
assert.ok(!wallet.includes('Recarregar saldo') && !wallet.includes('Adicionar dinheiro'), 'Nao ativar operacao financeira sem provider');

console.log('[OK] APOIS Cliente Carteira: painel real, saldo/pendencias isolados por usuario, estados seguros e nenhuma mutacao financeira.');
